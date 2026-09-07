// ==========================================
// BACKGROUND SCRIPT / SERVICE WORKER
// ==========================================
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  const originTabId = sender.tab ? sender.tab.id : null;

  // ------------------------------------------
  // 1. Handle DLIMS Request
  // ------------------------------------------
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
        isSubmitted: false // Initialize submission lock
      });
    });
  }
  
  // ------------------------------------------
  // 2. Handle IRIS Request
  // ------------------------------------------
  if (request.action === "open_iris_background") {
    chrome.tabs.create({
      url: "https://iris.fbr.gov.pk/", // Replace with the actual IRIS URL if different
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

  // ------------------------------------------
  // 3. Handle DLIMS Data Response & Cleanup
  // ------------------------------------------
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

  // ------------------------------------------
  // 4. Handle IRIS Data Response & Cleanup
  // ------------------------------------------
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

  // Add this block inside your chrome.runtime.onMessage listener in background.js:
  if (request.action === "fetch_domicile_background" && request.id) {
    const targetUrl = `https://domicile.punjab.gov.pk/AjaxCall.aspx?ID=${request.id}`;

    fetch(targetUrl)
      .then(response => {
        if (!response.ok) throw new Error(`HTTP error! Status: ${response.status}`);
        return response.text();
      })
      .then(htmlText => sendResponse({ success: true, data: htmlText }))
      .catch(error => sendResponse({ success: false, error: error.message }));

    return true; // Keep message channel open for async response
  }
  // ------------------------------------------
  // 6. NEW: Handle WhatsApp Tab Management
  // ------------------------------------------
  if (request.action === "open_whatsapp_background" && request.targetUrl) {
    const targetUrl = request.targetUrl;

    // Search for an already open web.whatsapp.com tab
    chrome.tabs.query({ url: "https://web.whatsapp.com/*" }, (tabs) => {
      if (tabs && tabs.length > 0) {
        const existingTab = tabs[0];
        
        // Update the existing tab and bring it/its window into focus
        chrome.tabs.update(existingTab.id, { url: targetUrl, active: true }, () => {
          chrome.windows.update(existingTab.windowId, { focused: true });
        });
      } else {
        // If no WhatsApp tab is open, create a new one
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
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onloadend = () => resolve(reader.result);
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
  } catch (error) {
    console.error("Failed to convert image to Base64:", error);
    return imageUrl; // Fallback to raw URL on failure
  }
}

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "openWithAtauxel" || !tab?.id) return;

  let payload = "";
  const isPageContext = info.mediaType === undefined && !info.selectionText && !info.linkUrl && info.pageUrl;

  // Extract input IDs from current source tab
  let inputIds = [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => Array.from(document.querySelectorAll("input[id]")).map(el => ({
        id: el.id,
        label: el.name || el.placeholder || el.id
      }))
    });
    if (results && results.length > 0) {
      inputIds = results.flatMap(r => r.result || []);
    }
  } catch (error) {
    console.error("Failed to fetch input IDs:", error);
  }

  // Inject Storage Listener into SOURCE TAB to receive updates
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id, allFrames: true },
      func: () => {
        if (window.hasAtauxelSync) return;
        window.hasAtauxelSync = true;

        chrome.storage.onChanged.addListener((changes, area) => {
          if (area === "local" && changes.atauxelSync) {
            const { inputId, value } = changes.atauxelSync.newValue || {};
            if (!inputId) return;

            const targetInput = document.getElementById(inputId);
            if (targetInput) {
              targetInput.value = value;
              
              // Support React/Vue internal state updates
              const tracker = targetInput._valueTracker;
              if (tracker) tracker.setValue(value);

              targetInput.dispatchEvent(new Event("input", { bubbles: true }));
              targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      }
    });
  } catch (err) {
    console.error("Failed to inject storage listener on source page:", err);
  }

  // Determine payload (Convert images to Base64)
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

  // If payload is Base64, store it in storage to prevent URL overflow
  if (isBase64) {
    imageStorageKey = `atauxel_img_${Date.now()}`;
    await chrome.storage.local.set({ [imageStorageKey]: payload });
  }

  const encodedPayload = isBase64 ? "" : encodeURIComponent(payload);
  const encodedInputIds = encodeURIComponent(JSON.stringify(inputIds.map(item => item.id)));
  
  // Append imageKey query parameter if an image was stored
  let targetUrl = `https://atauxel.vercel.app/?data=${encodedPayload}&inputIds=${encodedInputIds}`;
  if (isBase64) {
    targetUrl += `&imageKey=${imageStorageKey}`;
  }

  let atauxelTabId = null;

  if (isPageContext && tab.windowId) {
    const currentWin = await chrome.windows.get(tab.windowId);
    const screenLeft = currentWin.left || 0;
    const screenTop = currentWin.top || 0;
    const screenWidth = currentWin.width || 1920;
    const screenHeight = currentWin.height || 1080;
    const halfWidth = Math.floor(screenWidth / 2);

    await chrome.windows.update(tab.windowId, {
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

  // Populate #output once Atauxel tab loads
  if (atauxelTabId) {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === atauxelTabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        chrome.scripting.executeScript({
          target: { tabId: atauxelTabId },
          func: async (extractedInputs, payloadData, isImage, storageKey) => {
            let outputDiv = document.querySelector("#output");
            if (!outputDiv) {
              outputDiv = document.createElement("div");
              outputDiv.id = "output";
              document.body.appendChild(outputDiv);
            }

            const payloadBlock = document.createElement("div");
            payloadBlock.style.marginBottom = "8px";

            let finalImageSrc = payloadData;

            // If payload is stored in extension storage, fetch it
            if (isImage && storageKey) {
              const data = await chrome.storage.local.get(storageKey);
              finalImageSrc = data[storageKey] || payloadData;
              // Clean up storage after reading
              chrome.storage.local.remove(storageKey);
            }

            if (isImage) {
              const img = document.createElement("img");
              img.src = finalImageSrc;
              img.style.maxWidth = "100%";
              img.style.borderRadius = "4px";
              payloadBlock.appendChild(img);
            } else {
              payloadBlock.style.fontWeight = "bold";
              payloadBlock.textContent = payloadData;
            }
            outputDiv.appendChild(payloadBlock);

            // Render Input IDs
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
          args: [inputIds, payload, isBase64, imageStorageKey]
        });
      }
    });
  }
});