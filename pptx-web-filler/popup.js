// popup.js

document.getElementById('processBtn').addEventListener('click', async () => {
  const fileInput = document.getElementById('pptxInput');
  if (fileInput.files.length === 0) return alert("Please select a file.");

  const reader = new FileReader();
  reader.onload = async (e) => {
    try {
      const zip = await JSZip.loadAsync(e.target.result);
      const data = {};
      const parser = new DOMParser();

      // --- PPTX FILE PROCESSING ---
      const slideFiles = Object.keys(zip.files).filter(path => /^ppt\/slides\/slide\d+\.xml$/.test(path));
      
      for (const filePath of slideFiles) {
        const xmlString = await zip.file(filePath).async("string");
        const xmlDoc = parser.parseFromString(xmlString, "text/xml");
        const paragraphs = xmlDoc.getElementsByTagName("a:p");

        for (let p of paragraphs) {
          const textNodes = p.getElementsByTagName("a:t");
          let line = Array.from(textNodes).map(t => t.textContent).join("");
          
          if (line.includes(':')) {
            const parts = line.split(':');
            const key = parts[0].trim();
            const value = parts.slice(1).join(':').trim();
            if (key) data[key] = value;
          }
        }
      }

      // --- INJECTED SCRIPT FOR FUZZY AUTO-FILL ---
      // --- INJECTED SCRIPT FOR FUZZY AUTO-FILL WITH DEPENDENCY HANDLING ---
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (!tabs[0]) return;

  chrome.scripting.executeScript({
    target: { tabId: tabs[0].id },
    func: async (data) => {
      const normalize = (str) => (str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '');
      const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

      const setAndTrigger = (el, value) => {
        // Native value setter trick for frameworks like React/Angular/Vue
        const prototype = Object.getPrototypeOf(el);
        const descriptor = Object.getOwnPropertyDescriptor(prototype, 'value');
        if (descriptor && descriptor.set) {
          descriptor.set.call(el, value);
        } else {
          el.value = value;
        }

        // Dispatch comprehensive sequence of interaction events
        ['compositionstart', 'input', 'keydown', 'keyup', 'change', 'blur'].forEach((evType) => {
          el.dispatchEvent(new Event(evType, { bubbles: true, cancelable: true }));
        });
      };

      const findFuzzyElement = (key) => {
        const normalizedKey = normalize(key);
        if (!normalizedKey) return null;

        const elements = document.querySelectorAll('input, textarea, select');
        let bestMatch = null;
        let highestScore = 0;

        for (const el of elements) {
          const type = el.getAttribute('type');
          if (['submit', 'button', 'reset', 'hidden', 'image'].includes(type)) continue;

          let score = 0;
          const id = normalize(el.id);
          const name = normalize(el.name);
          const placeholder = normalize(el.getAttribute('placeholder'));
          const autocomplete = normalize(el.getAttribute('autocomplete'));

          if ((id && id === normalizedKey) || (name && name === normalizedKey)) score += 20;

          const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
          if (label && normalize(label.textContent).includes(normalizedKey)) score += 15;

          if (placeholder && placeholder.includes(normalizedKey)) score += 10;
          if (autocomplete && autocomplete.includes(normalizedKey)) score += 10;

          if (id && (id.includes(normalizedKey) || normalizedKey.includes(id))) score += 5;
          if (name && (name.includes(normalizedKey) || normalizedKey.includes(name))) score += 5;

          if (score > highestScore) {
            highestScore = score;
            bestMatch = el;
          }
        }
        return highestScore >= 10 ? bestMatch : null;
      };

      // Helper to poll for matching options in cascading dropdowns that fetch options asynchronously
      const waitForSelectOptions = async (selectEl, targetValue, maxRetries = 10) => {
        for (let i = 0; i < maxRetries; i++) {
          const option = Array.from(selectEl.options).find(
            (o) => normalize(o.text).includes(normalize(targetValue)) || o.value === targetValue
          );
          if (option) return option;
          await sleep(200); // Retry every 200ms up to 2 seconds
        }
        return null;
      };

      // --- Asynchronous Sequential Processing Loop ---
      for (const [key, value] of Object.entries(data)) {
        const el = findFuzzyElement(key);
        if (!el) continue;

        if (el.tagName === 'SELECT') {
          const isDefault = el.selectedIndex <= 0 || el.value === '';
          if (!isDefault) continue;

          // Poll for dynamically loaded options (for cascading dependencies)
          const option = await waitForSelectOptions(el, value);

          if (option) {
            setAndTrigger(el, option.value);
            // Pause execution to allow dependent XHR/AJAX requests or UI state updates to finish
            await sleep(500);
          }
        } else {
          if (el.value && el.value.trim() !== '') continue;
          setAndTrigger(el, value);
        }
      }
    },
    args: [data]
  });
});
    } catch (err) {
      console.error(err);
      alert("Error parsing PPTX file.");
    }
  };
  reader.readAsArrayBuffer(fileInput.files[0]);
});