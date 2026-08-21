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
// CONTEXT MENU SETUP & CLICK HANDLER
// ==========================================
chrome.runtime.onInstalled.addListener(() => {
  chrome.contextMenus.create({
    id: "openWithAtauxel",
    title: "Open with Atauxel",
    contexts: ["selection", "image", "link", "editable", "page"]
  });
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  if (info.menuItemId === "openWithAtauxel") {
    let payload = "";

    // Check if the click happened strictly on the 'page' context
    const isPageContext = info.mediaType === undefined && !info.selectionText && !info.linkUrl && info.pageUrl;

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

    const targetUrl = `https://atauxel.vercel.app/?data=${encodeURIComponent(payload)}`;

    // If it's a 'page' context, dynamically calculate screen size and split 50/50
    if (isPageContext && tab && tab.windowId) {
      // Fetch the actual current window's position and screen metrics
      const currentWin = await chrome.windows.get(tab.windowId);
      
      // Fallback coordinates if bounds aren't exposed
      const screenLeft = currentWin.left || 0;
      const screenTop = currentWin.top || 0;
      
      // Use the monitor's usable width/height or fallback to standard bounds
      const screenWidth = currentWin.width || 1920;
      const screenHeight = currentWin.height || 1080;
      const halfWidth = Math.floor(screenWidth / 2);

      // 1. Un-maximize current window and snap it strictly to the left half of THIS screen
      await chrome.windows.update(tab.windowId, {
        state: "normal",
        left: screenLeft,
        top: screenTop,
        width: halfWidth,
        height: screenHeight,
        focused: true
      });

      // 2. Open Atauxel on the right half of THIS screen
      const rightWin = await chrome.windows.create({
        url: targetUrl,
        state: "normal",
        left: screenLeft + halfWidth,
        top: screenTop,
        width: screenWidth - halfWidth,
        height: screenHeight,
        focused: true
      });

      // 3. Re-enforce bounds to lock the 50/50 split cleanly
      await chrome.windows.update(tab.windowId, {
        state: "normal",
        left: screenLeft,
        top: screenTop,
        width: halfWidth,
        height: screenHeight
      });

      await chrome.windows.update(rightWin.id, {
        state: "normal",
        left: screenLeft + halfWidth,
        top: screenTop,
        width: screenWidth - halfWidth,
        height: screenHeight,
        focused: true
      });

    } else {
      // Standard behavior for images, links, selected text, etc.
      chrome.tabs.create({ url: targetUrl, active: true });
    }
  }
});