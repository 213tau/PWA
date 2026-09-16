// ==========================================
// BACKGROUND SCRIPT / SERVICE WORKER
// ==========================================

// ------------------------------------------
// Global Script Injection for Multi-Line Paste Support
// ------------------------------------------
chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  // Only inject script into normal, complete webpages
  if (changeInfo.status === 'complete' && tab.url && !tab.url.startsWith('chrome://') && !tab.url.startsWith('edge://')) {
    chrome.scripting.executeScript({
      target: { tabId: tabId },
      func: setupGlobalSequentialPaste
    }).catch(err => console.log("Script injection skipped/failed for tab:", tabId, err));
  }
});

/**
 * Injected into every tab page to handle multi-line sequential pasting
 */
function setupGlobalSequentialPaste() {
  if (window.hasAtauxelSequentialPaste) return;
  window.hasAtauxelSequentialPaste = true;

  document.addEventListener('paste', function (e) {
    const activeEl = document.activeElement;

    // Ensure focus is inside a fillable element
    const isInput = activeEl.tagName === 'INPUT' || activeEl.tagName === 'TEXTAREA' || activeEl.isContentEditable;
    if (!isInput) return;

    // Get pasted clipboard text
    const pasteData = (e.clipboardData || window.clipboardData).getData('text');
    const lines = pasteData
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(line => line.length > 0);

    // If single line, allow standard paste behavior
    if (lines.length <= 1) return;

    // Prevent default multi-line block dump into 1 element
    e.preventDefault();

    // Collect all visible form fields on the page
    const fields = Array.from(
      document.querySelectorAll('input:not([type="hidden"]):not([type="submit"]):not([type="button"]), textarea, [contenteditable="true"]')
    ).filter(el => {
      const style = window.getComputedStyle(el);
      return style.display !== 'none' && style.visibility !== 'hidden' && !el.disabled;
    });

    const startIndex = fields.indexOf(activeEl);
    if (startIndex === -1) return;

    // Sequentially populate inputs line-by-line
    lines.forEach((lineText, offset) => {
      const targetField = fields[startIndex + offset];
      if (targetField) {
        if (targetField.isContentEditable) {
          targetField.innerText = lineText;
        } else {
          targetField.value = lineText;
        }

        // Trigger input events to keep React/Vue states updated
        const tracker = targetField._valueTracker;
        if (tracker) tracker.setValue(lineText);

        targetField.dispatchEvent(new Event('input', { bubbles: true }));
        targetField.dispatchEvent(new Event('change', { bubbles: true }));
      }
    });
  });
}

// ------------------------------------------
// Existing Chrome Runtime Message Listeners
// ------------------------------------------
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const originTabId = sender.tab ? sender.tab.id : null;

  // 1. Handle DLIMS Request
  if (request.action === "open_dlims_background") {
    chrome.tabs.create({
      url: "https://dlims.punjab.gov.pk/elicense",
      active: false 
    }, (tab) => {
      chrome.storage.local.set({
        pendingCnic: request.cnic,
        pendingDob: request.dob,
        targetTabId: tab.id,
        originTabId: originTabId,
        isSubmitted: false
      });
    });
  }
  
  // 2. Handle IRIS Request
  if (request.action === "open_iris_background") {
    chrome.tabs.create({
      url: "https://iris.fbr.gov.pk/",
      active: false 
    }, (tab) => {
      chrome.storage.local.set({
        pendingCnic: request.cnic,
        targetTabId: tab.id,
        originTabId: originTabId,
        isSubmitted: false
      });
    });
  }

  // 3. Handle DLIMS Data Response & Cleanup
  if (request.action === "dlims_data_fetched") {
    chrome.storage.local.get(["originTabId", "targetTabId"], (data) => {
      if (data.originTabId) {
        chrome.tabs.sendMessage(data.originTabId, {
          action: "DLIMS_DATA_RESPONSE",
          data: request.data
        }).catch(() => {
          broadcastToPWA("DLIMS_DATA_RESPONSE", request.data);
        });
      } else {
        broadcastToPWA("DLIMS_DATA_RESPONSE", request.data);
      }

      cleanupWorker(data.targetTabId);
    });
  }

  // 4. Handle IRIS Data Response & Cleanup
  if (request.action === "iris_data_fetched") {
    chrome.storage.local.get(["originTabId", "targetTabId"], (data) => {
      if (data.originTabId) {
        chrome.tabs.sendMessage(data.originTabId, {
          action: "IRIS_DATA_RESPONSE",
          data: request.data
        }).catch(() => {
          broadcastToPWA("IRIS_DATA_RESPONSE", request.data);
        });
      } else {
        broadcastToPWA("IRIS_DATA_RESPONSE", request.data);
      }

      cleanupWorker(data.targetTabId);
    });
  }

  // 5. Handle Domicile Fetch Request
  if (request.action === "fetch_domicile_background" && request.id) {
    const targetUrl = `https://domicile.punjab.gov.pk/AjaxCall.aspx?ID=${request.id}`;

    fetch(targetUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.text();
      })
      .then(htmlText => sendResponse({ success: true, data: htmlText }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep channel open for async response
  }

  // 6. Handle WhatsApp Tab Management
  if (request.action === "open_whatsapp_background" && request.targetUrl) {
    const targetUrl = request.targetUrl;

    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const existingTab = tabs[0];
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
          chrome.windows.update(existingTab.windowId, { focused: true });
        });
      } else {
        chrome.tabs.create({ url: targetUrl });
      }
    });
  }
});

// Helper function to broadcast messages if the origin tab reference is lost
function broadcastToPWA(actionType, dataPayload) {
  chrome.tabs.query({ url: "https://atauxel.vercel.app/*" }, (tabs) => {
    tabs.forEach((tab) => {
      chrome.tabs.sendMessage(tab.id, {
        action: actionType,
        data: dataPayload
      }).catch(() => {}); 
    });
  });
}

// Helper function to handle tab removal and storage clearing
function cleanupWorker(targetTabId) {
  if (targetTabId) {
    chrome.tabs.remove(targetTabId).catch(() => {});
  }

  chrome.storage.local.remove([
    "pendingCnic", 
    "pendingDob", 
    "targetTabId", 
    "originTabId",
    "isSubmitted"
  ]);
}

chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openWithAtauxel",
    title: "Open with Atauxel",
    contexts: ["selection", "image", "link", "editable", "page"]
  });
});

// Helper: Convert Image URL -> Blob -> Base64
async function urlToBase64(imageUrl) {
  try {
    const response = await fetch(imageUrl);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image to Base64:", error);
    return imageUrl;
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "openWithAtauxel" || !tab?.id) return;

  const rawTabId = tab.id;
  const rawWindowId = tab.windowId;

  const sessionId = `atauxel_session_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`;

  let payload = "";
  const isPageContext = info.mediaType === undefined && !info.selectionText && !info.linkUrl && info.pageUrl;

  let inputIds = [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: rawTabId },
      func: (sid) => {
        window.sessionStorage.setItem("ATAUXEL_SESSION_ID", sid);
        window.ATAUXEL_SESSION_ID = sid;

        if (!window.hasAtauxelSync) {
          window.hasAtauxelSync = true;

          chrome.storage.onChanged.addListener((changes, area) => {
            if (area === "local" && changes.atauxelSync) {
              const data = changes.atauxelSync.newValue || {};
              const currentSid = window.sessionStorage.getItem("ATAUXEL_SESSION_ID") || window.ATAUXEL_SESSION_ID;

              if (data.sessionId === currentSid && data.inputId) {
                const targetInput = document.getElementById(data.inputId);
                if (targetInput) {
                  targetInput.value = data.value;

                  const tracker = targetInput._valueTracker;
                  if (tracker) tracker.setValue(data.value);

                  targetInput.dispatchEvent(new Event("input", { bubbles: true }));
                  targetInput.dispatchEvent(new Event("change", { bubbles: true }));
                }
              }
            }
          });
        }

        return Array.from(document.querySelectorAll("input[id], textarea[id]")).map(el => ({
          id: el.id,
          label: el.name || el.placeholder || el.id
        }));
      },
      args: [sessionId]
    });

    if (results && results[0]?.result) {
      inputIds = results[0].result;
    }
  } catch (error) {
    console.error("Failed to initialize source page listener:", error);
  }

  if (info.mediaType === "image" && info.srcUrl) {
    payload = await urlToBase64(info.srcUrl);
  } else if (info.selectionText) {
    payload = info.selectionText;
  } else if (info.srcUrl) {
    payload = await urlToBase64(info.srcUrl);
  } else if (info.linkUrl) {
    payload = info.linkUrl;
  } else if (info.pageUrl) {
    payload = info.pageUrl;
  }

  if (!payload) return;

  const isBase64 = payload.startsWith("data:image/");
  let imageStorageKey = "";

  if (isBase64) {
    imageStorageKey = `atauxel_img_${Date.now()}`;
    await chrome.storage.local.set({ [imageStorageKey]: payload });
  }

  const encodedPayload = isBase64 ? "" : encodeURIComponent(payload);
  const encodedInputIds = encodeURIComponent(JSON.stringify(inputIds.map(item => item.id)));

  let targetUrl = `https://atauxel.vercel.app/?data=${encodedPayload}&inputIds=${encodedInputIds}&sessionId=${sessionId}`;
  if (isBase64) {
    targetUrl += `&imageKey=${imageStorageKey}`;
  }

  let atauxelTabId = null;

  if (isPageContext && rawWindowId) {
    const currentWin = await chrome.windows.get(rawWindowId);
    const screenLeft = currentWin.left || 0;
    const screenTop = currentWin.top || 0;
    const screenWidth = currentWin.width || 1920;
    const screenHeight = currentWin.height || 1080;
    const halfWidth = Math.floor(screenWidth / 2);

    await chrome.windows.update(rawWindowId, {
      state: "normal",
      left: screenLeft,
      top: screenTop,
      width: halfWidth,
      height: screenHeight,
      focused: true
    });

    const rightWin = await chrome.windows.create({
      url: targetUrl,
      state: "normal",
      left: screenLeft + halfWidth,
      top: screenTop,
      width: screenWidth - halfWidth,
      height: screenHeight,
      focused: true
    });

    atauxelTabId = rightWin.tabs?.[0]?.id || null;
  } else {
    const newTab = await chrome.tabs.create({ url: targetUrl, active: true });
    atauxelTabId = newTab.id;
  }

  if (atauxelTabId) {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === atauxelTabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        chrome.scripting.executeScript({
          target: { tabId: atauxelTabId },
          func: async (extractedInputs, payloadData, isImage, storageKey, activeSessionId) => {
            if (!window.hasAtauxelRelay) {
              window.hasAtauxelRelay = true;
              window.addEventListener("message", (event) => {
                if (event.data?.type === "ATAUXEL_TYPE_SYNC") {
                  chrome.storage.local.set({
                    atauxelSync: {
                      inputId: event.data.inputId,
                      value: event.data.value,
                      sessionId: activeSessionId,
                      ts: Date.now()
                    }
                  });
                }
              });
            }

            let outputDiv = document.querySelector("#output");
            if (!outputDiv) {
              outputDiv = document.createElement("div");
              outputDiv.id = "output";
              document.body.appendChild(outputDiv);
            }

            const payloadBlock = document.createElement("div");
            payloadBlock.style.marginBottom = "8px";

            let finalImageSrc = payloadData;

            if (isImage && storageKey) {
  const data = await chrome.storage.local.get(storageKey);
  finalImageSrc = data[storageKey] || payloadData;
  chrome.storage.local.remove(storageKey);
}

if (isImage && finalImageSrc) {
  let images = [];
  let currentImageIndex = 0;
  let draggingPoint = null;
  let current = null; // Declare in scope to prevent undefined errors elsewhere

  class ImageObject {
    constructor(img, altText = "") {
      this.img = img;
      // Default corner points based on natural dimensions
      this.points = [
        { x: 0, y: 0 },
        { x: img.naturalWidth || img.width, y: 0 },
        { x: img.naturalWidth || img.width, y: img.naturalHeight || img.height },
        { x: 0, y: img.naturalHeight || img.height }
      ];
      this.imageData = null;
      this.altText = altText;
    }
  }

  const img = new Image();
  img.crossOrigin = "anonymous";

  img.onload = () => {
    // 1. Instantiation
    current = new ImageObject(img);
    images[currentImageIndex] = current;

    // 2. DPI & Dimension Scaling
    const imageDPI = current?.dpi || 300;
    const scaleFactor = (imageDPI > 0 ? imageDPI : 300) / 300;

    const displayWidth = img.naturalWidth / scaleFactor;
    const displayHeight = img.naturalHeight / scaleFactor;

    // Scale points to display canvas dimensions
    current.points = [
      { x: 0, y: 0 },
      { x: displayWidth, y: 0 },
      { x: displayWidth, y: displayHeight },
      { x: 0, y: displayHeight }
    ];

    // 3. Canvas Setup
    const canvas = document.getElementById("canvas");
    if (!canvas) return;

    canvas.width = displayWidth;
    canvas.height = displayHeight;

    const ctx = canvas.getContext("2d");
    ctx.clearRect(0, 0, displayWidth, displayHeight);
    ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

    current.imageData = ctx.getImageData(0, 0, displayWidth, displayHeight);

    // 4. Safe Point Rendering (Guarded with Optional Chaining)
    const points = current?.points;
    if (typeof pointsDrawn !== "undefined" && pointsDrawn && Array.isArray(points)) {
      const fontSize = Math.floor(displayWidth * 0.025);
      const circleRadius = Math.floor(displayWidth * 0.018);

      // Lines
      ctx.strokeStyle = "blue";
      ctx.setLineDash([5, 5]);
      ctx.beginPath();
      points.forEach((start, i) => {
        const end = points[(i + 1) % points.length];
        if (start && end) {
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        }
      });
      ctx.stroke();
      ctx.setLineDash([]);

      // Point Handles
      points.forEach((pt, i) => {
        if (!pt) return;
        ctx.globalAlpha = 0.7;
        ctx.fillStyle = "red";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "white";
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, circleRadius, 0, Math.PI * 2);
        ctx.fill();

        ctx.globalAlpha = 1.0;
        ctx.fillStyle = "black";
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.fillText(i + 1, pt.x, pt.y);
      });
    }

    canvas.style.display = "block";

    // 5. Controls & Handlers
    if (typeof setupRotationSlider === "function") setupRotationSlider();
    if (typeof handleMagicWandClick === "function") {
      canvas.oncontextmenu = handleMagicWandClick;
    }

    // 6. DOM Updates
    const container = document.querySelector("#printTools");
    if (container) {
      img.id = `img-${currentImageIndex}`;
      const existingImg = container.querySelector(`#${img.id}`);
      if (existingImg && existingImg !== img) {
        container.replaceChild(img, existingImg);
      } else if (!existingImg) {
        container.appendChild(img);
      }
    }
  };

  img.onerror = () => console.error("Failed to load image source:", finalImageSrc);
  img.src = finalImageSrc;

  if (img.complete && img.naturalWidth > 0) img.onload();
} else {
              payloadBlock.style.fontWeight = "bold";
              payloadBlock.textContent = payloadData;
            }
            outputDiv.appendChild(payloadBlock);

            extractedInputs.forEach(item => {
              const childDiv = document.createElement("div");
              childDiv.id = item.label || item.id;
              childDiv.contentEditable = "true";
              childDiv.style.border = "1px solid #ccc";
              childDiv.style.padding = "4px";
              childDiv.style.margin = "4px 0";

              childDiv.addEventListener("input", () => {
                window.postMessage({
                  type: "ATAUXEL_TYPE_SYNC",
                  inputId: item.id,
                  value: childDiv.textContent
                }, "*");
              });

              outputDiv.appendChild(childDiv);
            });
          },
          args: [inputIds, payload, isBase64, imageStorageKey, sessionId]
        });
      }
    });
  }
});