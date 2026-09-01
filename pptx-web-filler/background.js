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
// ==========================================
// 1. MESSAGING RELAY (Atauxel -> Background -> Original Web Page)
// ==========================================
chrome.runtime.onMessage.addListener((message) => {
  if (message.action === "syncValueToSourcePage" && message.sourceTabId) {
    chrome.tabs.sendMessage(message.sourceTabId, {
      action: "updateInputValue",
      inputId: message.inputId,
      value: message.value
    }).catch(err => console.error("Could not sync value to origin tab:", err));
  }
});

// ==========================================
// 2. CONTEXT MENU SETUP & MAIN EVENT HANDLER
// ==========================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openWithAtauxel",
    title: "Open with Atauxel",
    contexts: ["selection", "image", "link", "editable", "page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId !== "openWithAtauxel" || !tab?.id) return;

  let payload = "";
  const isPageContext = info.mediaType === undefined && !info.selectionText && !info.linkUrl && info.pageUrl;

  // Extract input IDs from the current source tab
  let inputIds = [];
  try {
    const results = await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => Array.from(document.querySelectorAll("input[id]")).map(el => ({
        id: el.id,
        label: el.name || el.placeholder || el.id
      }))
    });
    if (results && results[0]) {
      inputIds = results[0].result;
    }
  } catch (error) {
    console.error("Failed to fetch input IDs from tab:", error);
  }

  // Inject listener into original web page to receive typed values
  try {
    await chrome.scripting.executeScript({
      target: { tabId: tab.id },
      func: () => {
        if (window.hasAtauxelSyncHandler) return;
        window.hasAtauxelSyncHandler = true;

        chrome.runtime.onMessage.addListener((msg) => {
          if (msg.action === "updateInputValue") {
            const targetInput = document.getElementById(msg.inputId);
            if (targetInput) {
              targetInput.value = msg.value;
              // Trigger input events to notify framework state managers (React, Vue, Svelte)
              targetInput.dispatchEvent(new Event("input", { bubbles: true }));
              targetInput.dispatchEvent(new Event("change", { bubbles: true }));
            }
          }
        });
      }
    });
  } catch (error) {
    console.error("Failed to inject sync listener on source tab:", error);
  }

  // Handle Payload Selection
  if (info.selectionText) {
    payload = info.selectionText;
  } else if (info.linkUrl) {
    payload = info.linkUrl;
  } else if (info.srcUrl) {
    try {
      const response = await fetch(info.srcUrl);
      const blob = await response.blob();
      payload = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    } catch (error) {
      console.error("Failed to fetch image source:", error);
      payload = info.srcUrl;
    }
  } else if (info.pageUrl) {
    payload = info.pageUrl;
  }

  if (!payload) return;

  const encodedPayload = encodeURIComponent(payload);
  const encodedInputIds = encodeURIComponent(JSON.stringify(inputIds.map(item => item.id)));
  const targetUrl = `https://atauxel.vercel.app/?data=${encodedPayload}&inputIds=${encodedInputIds}`;

  let atauxelTabId = null;

  // Handle 50/50 Window Split for Page Context
  if (isPageContext && tab.windowId) {
    const currentWin = await chrome.windows.get(tab.windowId);
    
    const screenLeft = currentWin.left || 0;
    const screenTop = currentWin.top || 0;
    const screenWidth = currentWin.width || 1920;
    const screenHeight = currentWin.height || 1080;
    const halfWidth = Math.floor(screenWidth / 2);

    // Snap current window left
    await chrome.windows.update(tab.windowId, {
      state: "normal",
      left: screenLeft,
      top: screenTop,
      width: halfWidth,
      height: screenHeight,
      focused: true
    });

    // Create Atauxel window right
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

  // Inject content & wire typing sync into Atauxel tab
  if (isPageContext && atauxelTabId) {
    chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
      if (tabId === atauxelTabId && changeInfo.status === "complete") {
        chrome.tabs.onUpdated.removeListener(listener);

        chrome.scripting.executeScript({
          target: { tabId: atauxelTabId },
          func: (extractedInputs, payloadUrl, sourceTabId) => {
            let outputDiv = document.querySelector("#output");
            if (!outputDiv) {
              outputDiv = document.createElement("div");
              outputDiv.id = "output";
              document.body.appendChild(outputDiv);
            }

            // Clear previous nodes
            outputDiv.innerHTML = "";

            // 1. Restore & append URL payload block inside #output
            const payloadContainer = document.createElement("div");
            payloadContainer.className = "payload-url-block";
            payloadContainer.style.marginBottom = "12px";
            payloadContainer.style.fontWeight = "bold";
            payloadContainer.textContent = `Page URL: ${payloadUrl}`;
            outputDiv.appendChild(payloadContainer);

            // 2. Append editable divs for input ID fields
            extractedInputs.forEach(item => {
              const childDiv = document.createElement("div");
              childDiv.id = item.label || item.id;
              
              // Make div editable to receive keystrokes
              childDiv.contentEditable = "true";
              childDiv.style.border = "1px solid #ccc";
              childDiv.style.padding = "6px";
              childDiv.style.margin = "4px 0";
              childDiv.style.minHeight = "20px";
              childDiv.dataset.inputId = item.id;

              // Fire sync event directly on typing
              childDiv.addEventListener("input", () => {
                chrome.runtime.sendMessage({
                  action: "syncValueToSourcePage",
                  sourceTabId: sourceTabId,
                  inputId: item.id,
                  value: childDiv.textContent
                });
              });

              outputDiv.appendChild(childDiv);
            });
          },
          args: [inputIds, payload, tab.id]
        }).catch(err => console.error("Failed to inject scripts into Atauxel tab:", err));
      }
    });
  }
});