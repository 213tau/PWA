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
      chrome.tabs.query({active: true, currentWindow: true}, (tabs) => {
        if (!tabs[0]) return;
        
        chrome.scripting.executeScript({
          target: {tabId: tabs[0].id},
          func: (data) => {
            const normalize = (str) => str ? str.toLowerCase().replace(/[^a-z0-9]/g, '') : '';

            const setAndTrigger = (el, value) => {
              el.value = value;
              ['input', 'change', 'blur'].forEach(ev => {
                el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true }));
              });
              
              const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
              if (descriptor && descriptor.set) {
                descriptor.set.call(el, value);
                el.dispatchEvent(new Event('input', { bubbles: true, cancelable: true }));
              }
            };

            const findFuzzyElement = (key) => {
  const normalizedKey = normalize(key);
  if (!normalizedKey) return null; // Guard against empty keys

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

    // Exact ID or Name matches
    if ((id && id === normalizedKey) || (name && name === normalizedKey)) score += 20;
    
    // Label matches
    const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
    if (label && normalize(label.textContent).includes(normalizedKey)) score += 15;

    // Placeholder or Autocomplete matches
    if (placeholder && placeholder.includes(normalizedKey)) score += 10;
    if (autocomplete && autocomplete.includes(normalizedKey)) score += 10;

    // Substring matches (ONLY if id or name is NOT empty)
    if (id && (id.includes(normalizedKey) || normalizedKey.includes(id))) score += 5;
    if (name && (name.includes(normalizedKey) || normalizedKey.includes(name))) score += 5;

    if (score > highestScore) {
      highestScore = score;
      bestMatch = el;
    }
  }
  // Require at least 10 points to consider it a valid match
  return highestScore >= 10 ? bestMatch : null;
};

            // --- Execution Loop with "Do Not Overwrite" guard ---
            for (const [key, value] of Object.entries(data)) {
              const el = findFuzzyElement(key);
              
              if (el) {
                if (el.tagName === 'SELECT') {
                  // Only overwrite if it's the default option (index 0) or empty
                  const isDefault = el.selectedIndex <= 0 || el.value === "";
                  if (!isDefault) continue;

                  const option = Array.from(el.options).find(o => 
                    normalize(o.text) === normalize(value) || o.value === value
                  );
                  if (option) setAndTrigger(el, option.value);
                } else {
                  // For standard inputs, only overwrite if currently empty
                  if (el.value && el.value.trim() !== "") continue;
                  setAndTrigger(el, value);
                }
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