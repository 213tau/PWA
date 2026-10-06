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

            // --- DATE UTILITIES ---

            // 1. Parses ambiguous date strings (YYYY-MM-DD, MM/DD/YYYY, DD-MM-YYYY, etc.)
            const parseDate = (dateStr) => {
              if (!dateStr || typeof dateStr !== 'string') return null;
              
              const str = dateStr.trim();
              
              // Standard ISO Format: YYYY-MM-DD or YYYY/MM/DD or YYYY.MM.DD
              let match = str.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})$/);
              if (match) {
                const [, year, month, day] = match;
                return new Date(year, month - 1, day);
              }

              // Day/Month Formats: DD-MM-YYYY or MM/DD/YYYY
              match = str.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})$/);
              if (match) {
                let [, part1, part2, year] = match.map(Number);
                
                // If part1 > 12, it must be DD/MM/YYYY
                if (part1 > 12) return new Date(year, part2 - 1, part1);
                // If part2 > 12, it must be MM/DD/YYYY
                if (part2 > 12) return new Date(year, part1 - 1, part2);
                
                // Default fallback: assume MM/DD/YYYY
                return new Date(year, part1 - 1, part2);
              }

              // Native JavaScript Date parsing fallback ("Jan 15, 2026", etc.)
              const parsed = new Date(str);
              return isNaN(parsed.getTime()) ? null : parsed;
            };

            // 2. Detects expected date format from input attributes, labels, or hints
            const detectDateFormat = (el) => {
              const placeholder = el.getAttribute('placeholder') || '';
              const pattern = el.getAttribute('pattern') || '';
              const label = (document.querySelector(`label[for="${el.id}"]`) || el.closest('label'))?.textContent || '';
              
              const combinedInfo = `${placeholder} ${pattern} ${label}`.toLowerCase();

              if (/yyyy[-/. ]mm[-/. ]dd/i.test(combinedInfo)) return 'YYYY-MM-DD';
              if (/dd[-/. ]mm[-/. ]yyyy/i.test(combinedInfo)) return 'DD-MM-YYYY';
              if (/mm[-/. ]dd[-/. ]yyyy/i.test(combinedInfo)) return 'MM-DD-YYYY';

              // Fallback based on separator hints in placeholder
              if (placeholder.includes('/')) return 'MM/DD/YYYY';
              if (placeholder.includes('.')) return 'DD.MM.YYYY';
              if (placeholder.includes('-')) return 'YYYY-MM-DD';

              return 'YYYY-MM-DD'; // Default fallback format
            };

            // 3. Formats a Date object into a targeted string format
            const formatDate = (dateObj, format) => {
              if (!dateObj || isNaN(dateObj.getTime())) return null;

              const yyyy = dateObj.getFullYear();
              const mm = String(dateObj.getMonth() + 1).padStart(2, '0');
              const dd = String(dateObj.getDate()).padStart(2, '0');

              switch (format) {
                case 'YYYY-MM-DD': return `${yyyy}-${mm}-${dd}`;
                case 'DD-MM-YYYY': return `${dd}-${mm}-${yyyy}`;
                case 'DD/MM/YYYY': return `${dd}/${mm}/${yyyy}`;
                case 'DD.MM.YYYY': return `${dd}.${mm}.${yyyy}`;
                case 'MM-DD-YYYY': return `${mm}-${dd}-${yyyy}`;
                case 'MM/DD/YYYY': return `${mm}/${dd}/${yyyy}`;
                default:           return `${yyyy}-${mm}-${dd}`;
              }
            };

            // --- DOM UTILITIES ---

            const setAndTrigger = (el, value) => {
              const descriptor = Object.getOwnPropertyDescriptor(Object.getPrototypeOf(el), "value");
              if (descriptor && descriptor.set) {
                descriptor.set.call(el, value);
              } else {
                el.value = value;
              }
              ['input', 'change', 'blur'].forEach(ev => {
                el.dispatchEvent(new Event(ev, { bubbles: true, cancelable: true }));
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

                // Exact ID or Name matches
                if ((id && id === normalizedKey) || (name && name === normalizedKey)) score += 20;
                
                // Label matches
                const label = document.querySelector(`label[for="${el.id}"]`) || el.closest('label');
                if (label && normalize(label.textContent).includes(normalizedKey)) score += 15;

                // Placeholder or Autocomplete matches
                if (placeholder && placeholder.includes(normalizedKey)) score += 10;
                if (autocomplete && autocomplete.includes(normalizedKey)) score += 10;

                // Substring matches
                if (id && (id.includes(normalizedKey) || normalizedKey.includes(id))) score += 5;
                if (name && (name.includes(normalizedKey) || normalizedKey.includes(name))) score += 5;

                if (score > highestScore) {
                  highestScore = score;
                  bestMatch = el;
                }
              }
              return highestScore >= 10 ? bestMatch : null;
            };

            // --- EXECUTION LOOP ---

            for (const [key, value] of Object.entries(data)) {
              const el = findFuzzyElement(key);
              
              if (el) {
                if (el.tagName === 'SELECT') {
                  const isDefault = el.selectedIndex <= 0 || el.value === "";
                  if (!isDefault) continue;

                  const option = Array.from(el.options).find(o => 
                    normalize(o.text) === normalize(value) || o.value === value
                  );
                  if (option) setAndTrigger(el, option.value);
                } else {
                  // Skip if field is already filled
                  if (el.value && el.value.trim() !== "") continue;

                  let valToSet = value;
                  const inputType = el.getAttribute('type') ? el.getAttribute('type').toLowerCase() : 'text';
                  
                  // Check if key/field implies a date
                  const isDateField = /date|dob|birth|expiry|created|due/i.test(key) || inputType === 'date';

                  if (isDateField) {
                    const parsedDate = parseDate(value);

                    if (parsedDate) {
                      if (inputType === 'date') {
                        // Native <input type="date"> requires strictly YYYY-MM-DD
                        valToSet = formatDate(parsedDate, 'YYYY-MM-DD');
                      } else {
                        // Text inputs inspect element context for expected format
                        const targetFormat = detectDateFormat(el);
                        valToSet = formatDate(parsedDate, targetFormat);
                      }
                    }
                  }

                  setAndTrigger(el, valToSet);
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