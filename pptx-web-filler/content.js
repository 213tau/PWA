// content.js
(() => {
  if (window.hasDropdownDropListenerAttached) return;

  const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

  const removeReadonly = (el) => {
    if (el && el.hasAttribute('readonly')) {
      el.dataset.wasReadonly = "true";
      el.removeAttribute('readonly');
    }
  };

  const restoreReadonly = (el) => {
    if (el && el.dataset.wasReadonly === "true") {
      el.setAttribute('readonly', 'true');
      delete el.dataset.wasReadonly;
    }
  };

  // Helper function to convert a Base64 Data URI into a native JS File Object
  const base64ToFile = (base64String, defaultFilename = 'dropped_image.jpg') => {
    const parts = base64String.split(';base64,');
    if (parts.length !== 2) throw new Error("Invalid base64 format");
    
    const contentType = parts[0].split(':')[1] || 'image/jpeg';
    const raw = window.atob(parts[1]);
    const rawLength = raw.length;
    const uInt8Array = new Uint8Array(rawLength);

    for (let i = 0; i < rawLength; ++i) {
      uInt8Array[i] = raw.charCodeAt(i);
    }

    return new File([uInt8Array], defaultFilename, { type: contentType });
  };

  // 1. ALLOW TYPING: Remove readonly when the user clicks/focuses on the element
  document.addEventListener('focusin', (e) => {
    const inputEl = e.target.closest('input[type="date"], select, input, textarea');
    if (inputEl) {
      removeReadonly(inputEl);
    }
  }, true);

  // RESTORE READONLY: Put it back when the user clicks away
  document.addEventListener('focusout', (e) => {
    const inputEl = e.target.closest('input[type="date"], select, input, textarea');
    if (inputEl) {
      restoreReadonly(inputEl);
    }
  }, true);

  // 2. DROP HANDLER
  document.addEventListener('drop', (e) => {
    const inputEl = e.target.closest('select, input, textarea');
    if (!inputEl) return;

    e.preventDefault();
    e.stopPropagation();

    removeReadonly(inputEl);

    const droppedText = e.dataTransfer.getData('text');
    if (!droppedText) return;

    const trimmedText = droppedText.trim();

    // NEW WORKING: Handle Base64 strings dropped into File inputs
    if (inputEl.tagName === 'INPUT' && inputEl.type === 'file' && trimmedText.startsWith('data:image/')) {
      try {
        const file = base64ToFile(trimmedText, 'uploaded_image.jpg');
        const dataTransfer = new DataTransfer();
        dataTransfer.items.add(file);
        inputEl.files = dataTransfer.files;
      } catch (err) {
        console.error("Failed to parse base64 image string:", err);
      }
    } 
    // PREVIOUS WORKING: Handle standard text inputs and select dropdowns
    else {
      const normalizedTarget = normalize(trimmedText);
      if (!normalizedTarget) return;

      if (inputEl.tagName === 'SELECT') {
        let bestOption = null;
        let highestOptionScore = 0;

        for (const option of inputEl.options) {
          const optValue = normalize(option.value);
          const optText = normalize(option.textContent);

          if (optValue === normalizedTarget || optText === normalizedTarget) {
            bestOption = option;
            highestOptionScore = 10;
            break; 
          }

          let score = 0;
          if (optText.includes(normalizedTarget) || normalizedTarget.includes(optText)) score += 4;
          if (optValue.includes(normalizedTarget) || normalizedTarget.includes(optValue)) score += 3;

          if (score > highestOptionScore) {
            highestOptionScore = score;
            bestOption = option;
          }
        }

        if (bestOption && highestOptionScore > 0) {
          inputEl.value = bestOption.value;
        }
      } else {
        inputEl.value = droppedText;
      }
    }

    // Common event triggers for frameworks (React, Vue, Angular, etc.)
    inputEl.dispatchEvent(new Event('input', { bubbles: true }));
    inputEl.dispatchEvent(new Event('change', { bubbles: true }));

    // Restore original state after drop completes
    restoreReadonly(inputEl);
  }, true);

  // 3. DRAGOVER HANDLER
  document.addEventListener('dragover', (e) => {
    const inputEl = e.target.closest('select, input, textarea');
    if (inputEl) {
      e.preventDefault();
      e.stopPropagation();
      removeReadonly(inputEl);
      e.dataTransfer.dropEffect = 'copy'; 
    }
  }, true);

  window.hasDropdownDropListenerAttached = true;
  console.log("Fuzzy Drop, Readonly Override & Base64 Image Support successfully injected.");
})();

// ==========================================
// PWA BRIDGE: Runs on atauxel.vercel.app
// ==========================================
// Ensure this script only runs on your target host
if (window.location.hostname.includes("atauxel.vercel.app")) {

  // =========================================================================
  // 1. LISTEN FOR MESSAGES FROM THE PWA PAGE (window.postMessage -> Extension)
  // =========================================================================
  window.addEventListener("message", (event) => {
    // Security check: drop messages from external sources
    if (event.origin !== window.location.origin) return;

    if (!event.data) return;

    // --- TYPING SYNC BACK TO SOURCE PAGE ---
    if (event.data.type === "ATAUXEL_TYPE_SYNC") {
      const { inputId, value } = event.data;
      chrome.storage.local.set({
        atauxelSync: {
          inputId: inputId,
          value: value,
          timestamp: Date.now()
        }
      });
    }

    // --- FETCH DLIMS DATA ---
    else if (event.data.type === "FETCH_DLIMS_DATA") {
      window.postMessage({ action: "UI_STATUS", status: "Initializing DLIMS request..." }, "*");

      chrome.runtime.sendMessage({
        action: "open_dlims_background",
        cnic: event.data.cnic,
        dob: event.data.dob
      });
    }

    // --- FETCH IRIS DATA ---
    else if (event.data.type === "FETCH_IRIS_DATA") {
      window.postMessage({ action: "UI_STATUS", status: "Initializing IRIS request..." }, "*");

      chrome.runtime.sendMessage({
        action: "open_iris_background",
        cnic: event.data.cnic
      });
    }

    // --- FETCH DOMICILE DATA ---
    else if (event.data.type === "FETCH_DOMICILE_DATA") {
      window.postMessage({ action: "UI_STATUS", status: "Fetching Domicile data..." }, "*");

      chrome.runtime.sendMessage({
        action: "fetch_domicile_background",
        id: event.data.id
      }, (response) => {
        const outputElement = document.querySelector("#output");
        if (response && response.success) {
          if (outputElement) outputElement.innerHTML += response.data;
          window.postMessage({ action: "UI_STATUS", status: "Domicile Data loaded successfully!" }, "*");
        } else {
          window.postMessage({ action: "UI_STATUS", status: "Error: " + (response?.error || "Failed to fetch") }, "*");
        }
      });
    }

    // --- OPEN WHATSAPP REQUEST ---
    else if (event.data.type === "OPEN_WHATSAPP") {
      const elementText = document.querySelector("#output")?.innerText || "";
      const regex = /(?:\+92|0)?3\d{2}[\s\-]?\d{7}/;
      const match = elementText.match(regex);

      if (match) {
        let phoneNumber = match[0];

        // Format phone number to standard international format (923XXXXXXXXX)
        if (phoneNumber.startsWith("0")) {
          phoneNumber = "92" + phoneNumber.substring(1);
        } else if (phoneNumber.startsWith("+")) {
          phoneNumber = phoneNumber.replace("+", "");
        }

        phoneNumber = phoneNumber.replace(/\D/g, "");
        const message = encodeURIComponent("Tanveer Studio!");
        const targetUrl = `https://web.whatsapp.com/send/?phone=${phoneNumber}&text=${message}&type=phone_number&app_absent=0`;

        chrome.runtime.sendMessage({
          action: "open_whatsapp_background",
          targetUrl: targetUrl
        });

        window.postMessage({ action: "UI_STATUS", status: "Opening WhatsApp..." }, "*");
      } else {
        window.postMessage({ action: "UI_STATUS", status: "Error: Please enter a valid phone number in #output." }, "*");
      }
    }
  });

  // =========================================================================
  // 2. LISTEN FOR MESSAGES FROM EXTENSION BACKGROUND SCRIPT (Extension -> PWA)
  // =========================================================================
  chrome.runtime.onMessage.addListener((message) => {
    const outputElement = document.querySelector("#output");
    if (!outputElement) return;

    if (message.action === "DLIMS_DATA_RESPONSE") {
      outputElement.innerHTML = message.data.html;
      window.postMessage({ action: "UI_STATUS", status: "DLIMS Data loaded successfully!" }, "*");
    } 
    else if (message.action === "IRIS_DATA_RESPONSE") {
      outputElement.innerHTML = message.data.html;
      window.postMessage({ action: "UI_STATUS", status: "IRIS Data loaded successfully!" }, "*");
    }
  });

}

// ==========================================
// DLIMS SCRAPER & AUTOMATION (Fixed for Page Reload)
// ==========================================
if (window.location.hostname.includes("dlims.punjab.gov.pk")) {

  function initAutomation() {
    chrome.storage.local.get(["pendingCnic", "pendingDob", "isSubmitted"], (data) => {
      // If we already submitted, skip filling the form and go straight to scraping results
      if (data.isSubmitted) {
        listenForResults();
        return;
      }

      if (!data.pendingCnic || !data.pendingDob) return;

      const cnicField = document.querySelector("#cnicInput");
      const dobField = document.querySelector("#dob");

      if (!cnicField || !dobField) {
        setTimeout(initAutomation, 500); 
        return; 
      }

      // 1. Populate credentials
      nativeInputValueSetter(cnicField, data.pendingCnic);
      nativeInputValueSetter(dobField, data.pendingDob);

      // 2. Solve captcha
      setTimeout(() => {
        const captchaCodeElem = document.querySelector("#captcha_code");
        const captchaText = captchaCodeElem ? captchaCodeElem.textContent : "";
        const numbers = captchaText.match(/\d+/g);

        if (numbers && numbers.length >= 2) {
          const result = parseInt(numbers[0], 10) + parseInt(numbers[1], 10);
          const captchaInput = document.querySelector("#captcha");
          if (captchaInput) {
            nativeInputValueSetter(captchaInput, result);
          }
        }

        // 3. Mark as submitted BEFORE clicking, so the reloaded page knows to look for results
        chrome.storage.local.set({ isSubmitted: true }, () => {
          const submitBtn = document.querySelector("#submit-btn");
          const form = document.querySelector("form.my_form");

          if (submitBtn) {
            submitBtn.click();
          } else if (form) {
            form.submit();
          }
        });
      }, 800);
    });
  }

  // 4. Dedicated function to scan the loaded page for results
  function listenForResults() {
    let attempts = 0;
    const maxAttempts = 20; // Try for 20 seconds

    const pollInterval = setInterval(() => {
      attempts++;
      const wrapperElement = document.querySelector(".d_wrapper") || 
                             document.querySelector("#resultContainer") || 
                             document.querySelector(".table-responsive");
      
      if (wrapperElement && wrapperElement.innerHTML.trim().length > 20) {
        clearInterval(pollInterval);
        
        // Send data back and reset isSubmitted for future runs
        chrome.runtime.sendMessage({
          action: "dlims_data_fetched",
          data: { status: "success", html: wrapperElement.innerHTML }
        }, () => {
          chrome.storage.local.set({ isSubmitted: false });
        });
      } else if (attempts >= maxAttempts) {
        clearInterval(pollInterval);
        chrome.runtime.sendMessage({
          action: "dlims_data_fetched",
          data: { status: "error", html: "<p>Timeout: Result container not found on results page.</p>" }
        }, () => {
          chrome.storage.local.set({ isSubmitted: false });
        });
      }
    }, 1000);
  }

  function nativeInputValueSetter(element, value) {
    const lastValue = element.value;
    element.value = value;
    const tracker = element._valueTracker;
    if (tracker) tracker.setValue(lastValue);
    element.dispatchEvent(new Event("input", { bubbles: true }));
    element.dispatchEvent(new Event("change", { bubbles: true }));
    element.dispatchEvent(new Event("blur", { bubbles: true }));
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", initAutomation);
  } else {
    initAutomation();
  }
}

if (window.location.hostname.includes("https://iris.fbr.gov.pk/")) {
// content_iris.js
async function fillIrisForm() {
    // 1. Get data from background
    const data = await new Promise(resolve => chrome.storage.local.get(["pendingCnic"], resolve));
    if (!data.pendingCnic) return;

    // 2. Select "CNIC" from the custom dropdown
    // Based on your HTML, the radio button with id="2" is for CNIC
    const cnicRadio = document.querySelector('input[id="2"][name="MR"]');
    if (cnicRadio) {
        cnicRadio.click();
        // Trigger change event for Angular
        cnicRadio.dispatchEvent(new Event('change', { bubbles: true }));
    }

    // 3. Fill the CNIC input
    // The input id="regNo" has maxlength="0", we must remove that restriction
    const cnicInput = document.getElementById("regNo");
    if (cnicInput) {
        cnicInput.removeAttribute("maxlength");
        cnicInput.value = data.pendingCnic;
        cnicInput.dispatchEvent(new Event('input', { bubbles: true }));
    }

    // 4. Focus on Captcha input
    const captchaInput = document.querySelector('input[placeholder="Enter "]');
    if (captchaInput) {
        captchaInput.focus();
    }
}

// Observe the DOM to detect when data is loaded
const observer = new MutationObserver(() => {
    // Look for the results container after clicking verify
    const resultContainer = document.querySelector(".R2C2C1-Body"); 
    // Add logic here to scrape the result when it appears
    // and send it to chrome.runtime.sendMessage({action: "iris_data_fetched", data: ...});
});

observer.observe(document.body, { childList: true, subtree: true });

// Initialize
fillIrisForm();
}
