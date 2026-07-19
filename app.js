    const upload = document.getElementById("upload");
    const imageSelector = document.getElementById("imageSelector");
    const warpBtn = document.getElementById("warpBtn");
    const cropBtn = document.getElementById("cropBtn");
    const canvas = document.getElementById("canvas");
    const ctx = canvas.getContext('2d', { willReadFrequently: true });

    let images = [];
    let currentImageIndex = 0;
    let draggingPoint = null;

    class ImageObject {
      constructor(img) {
        this.img = img;
        /*
        this.points = [
          { x: 10, y: 10 },
          { x: img.width - 10, y: 10 },
          { x: img.width - 10, y: img.height - 10 },
          { x: 10, y: img.height - 10 }
        ];
        */
        this.points = [
          { x: 0, y: 0 },
          { x: img.width, y: 0 },
          { x: img.width, y: img.height },
          { x: 0, y: img.height }
        ];
        this.imageData = null;
      }
    }

    let fileListPdf = [];

    upload.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files);
      fileListPdf.push(...files.map(file => ({ file })));

      const loadPromises = files.map(async (file) => {
        if (file.type === "image/svg+xml" || file.name.endsWith(".svg")) {
  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = () => {
      const parser = new DOMParser();
      const svgDoc = parser.parseFromString(reader.result, "image/svg+xml");
      const svgElement = svgDoc.querySelector("svg");

      // Insert SVG directly into the DOM
      document.body.appendChild(svgElement);

      resolve([svgElement]); // return SVG element for further use
    };

    reader.readAsText(file);
  });
} else if (file.type.startsWith("image/")) {
          return new Promise((resolve) => {
            const img = new Image();
            img.src = URL.createObjectURL(file);
            img.onload = () => resolve([new ImageObject(img, file)]);
            document.querySelector("canvas").style.display = "block";            
          });
        } else if (file.type === "application/pdf") {          
const pdfBytes = await file.arrayBuffer();
    const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;

    let fullText = "";

    for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);
        const textContent = await page.getTextContent();

        // Sort items by vertical position (y), then horizontal (x)
        const sortedItems = textContent.items.sort((a, b) => {
            const yDiff = b.transform[5] - a.transform[5]; // y coordinates
            if (Math.abs(yDiff) > 2) return yDiff; // threshold to detect new line
            return a.transform[4] - b.transform[4]; // x coordinates
        });

        let lastY = null;
        let pageText = "";

        for (const item of sortedItems) {
            const y = item.transform[5];
            // Add <br> if y changes significantly (new line)
            if (lastY !== null && Math.abs(y - lastY) > 2) {
                pageText += "<br>";
            }
            pageText += item.str;
            lastY = y;
        }

        if (pageText.trim()) {
            fullText += pageText + "<br><br>"; // separate pages
        }
        // -------- SVG RENDERING --------
const viewport = page.getViewport({ scale: 1 });
const opList = await page.getOperatorList();

const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
//svgGfx.embedFonts = true;

const svg = await svgGfx.getSVG(opList, viewport); // SVG exists only in memory

// -------- IMAGE EXTRACTION --------
const SELimages = svg.querySelectorAll("image");

for (const img of SELimages) {
    const href = img.getAttribute("href") || img.getAttribute("xlink:href");
    const width = parseFloat(img.getAttribute("width") || 0);

    // Skip images smaller than 300px width
    if (!href || width < 300) continue;

    try {
        const response = await fetch(href);
        const blob = await response.blob();

        const file = new File([blob], "embedded-image.png", { type: blob.type });

        await processFile(file);
        //images.push(new ImageObject(img, blob));
    } catch (err) {
        console.error("Error processing image:", err);
    }
}
    }

    console.log(fullText);

    //if (pdfDoc.numPages < 10) {
        document.querySelector("#output").innerHTML = fullText;
    //}
   return images; // <-- this is crucial

        } else if (file.type === "application/vnd.openxmlformats-officedocument.presentationml.presentation") {

  const zip = await JSZip.loadAsync(file);
  const output = document.querySelector("#output");
  output.innerHTML = "";

  const images = [];

  /* -------------------- IMAGE EXTRACTION -------------------- */
  for (const entry of Object.values(zip.files)) {
    if (entry.name.startsWith("ppt/media/") && !entry.dir) {
      const blob = await entry.async("blob");

      const img = new Image();
      img.src = URL.createObjectURL(blob);
      await new Promise(res => img.onload = res);

      images.push(new ImageObject(img, file));
    }
  }

  /* -------------------- SLIDE TEXT + TABLES -------------------- */
  const slideFiles = Object.values(zip.files)
    .filter(f => f.name.startsWith("ppt/slides/slide") && f.name.endsWith(".xml"));

  for (const slideFile of slideFiles) {

    const xmlText = await slideFile.async("text");
    const parser = new DOMParser();
    const xmlDoc = parser.parseFromString(xmlText, "application/xml");

    const slideDiv = document.createElement("div");
    slideDiv.className = "slide";

    /* ---------- TEXT SHAPES ---------- */
    const paragraphs = xmlDoc.getElementsByTagName("a:p");

    for (const p of paragraphs) {

      const pElement = document.createElement("p");

      /* ----- TEXT ALIGNMENT ----- */
      const pPr = p.getElementsByTagName("a:pPr")[0];
      if (pPr && pPr.getAttribute("algn")) {
        const alignMap = {
          l: "left",
          ctr: "center",
          r: "right",
          just: "justify"
        };
        pElement.style.textAlign = alignMap[pPr.getAttribute("algn")] || "left";
      }

      const runs = p.getElementsByTagName("a:r");

      for (const r of runs) {

        const textNode = r.getElementsByTagName("a:t")[0];
        if (!textNode) continue;

        const span = document.createElement("span");
        span.textContent = textNode.textContent;

        const rPr = r.getElementsByTagName("a:rPr")[0];

        if (rPr) {

          if (rPr.getAttribute("b") === "1")
            span.style.fontWeight = "bold";

          if (rPr.getAttribute("i") === "1")
            span.style.fontStyle = "italic";

          if (rPr.getAttribute("u"))
            span.style.textDecoration = "underline";

          if (rPr.getAttribute("sz")) {
            const size = parseInt(rPr.getAttribute("sz")) / 100;
            span.style.fontSize = size + "pt";
          }

          const colorNode = rPr.getElementsByTagName("a:srgbClr")[0];
          if (colorNode) {
            span.style.color = "#" + colorNode.getAttribute("val");
          }
        }

        pElement.appendChild(span);
      }

      if (pElement.textContent.trim() !== "")
        slideDiv.appendChild(pElement);
    }

    /* ---------- TABLE EXTRACTION ---------- */
    const tables = xmlDoc.getElementsByTagName("a:tbl");

    for (const tbl of tables) {

      const table = document.createElement("table");
      table.style.borderCollapse = "collapse";
      table.style.marginTop = "20px";

      const rows = tbl.getElementsByTagName("a:tr");

      for (const row of rows) {

        const tr = document.createElement("tr");
        const cells = row.getElementsByTagName("a:tc");

        for (const cell of cells) {

          const td = document.createElement("td");
          td.style.border = "1px solid #333";
          td.style.padding = "8px";

          const cellParagraphs = cell.getElementsByTagName("a:p");

          for (const cp of cellParagraphs) {

            const cellP = document.createElement("p");

            const cpPr = cp.getElementsByTagName("a:pPr")[0];
            if (cpPr && cpPr.getAttribute("algn")) {
              const alignMap = {
                l: "left",
                ctr: "center",
                r: "right",
                just: "justify"
              };
              cellP.style.textAlign = alignMap[cpPr.getAttribute("algn")] || "left";
            }

            const runs = cp.getElementsByTagName("a:r");

            for (const r of runs) {

              const textNode = r.getElementsByTagName("a:t")[0];
              if (!textNode) continue;

              const span = document.createElement("span");
              span.textContent = textNode.textContent;

              const rPr = r.getElementsByTagName("a:rPr")[0];

              if (rPr) {

                if (rPr.getAttribute("b") === "1")
                  span.style.fontWeight = "bold";

                if (rPr.getAttribute("i") === "1")
                  span.style.fontStyle = "italic";

                if (rPr.getAttribute("u"))
                  span.style.textDecoration = "underline";
              }

              cellP.appendChild(span);
            }

            td.appendChild(cellP);
          }

          tr.appendChild(td);
        }

        table.appendChild(tr);
      }

      slideDiv.appendChild(table);
    }

    output.appendChild(slideDiv);
  }

  document.querySelector("canvas").style.display = "block";

  return images;
} else if (file.name.endsWith('.zip') || file.type === 'application/zip') {
    const jszip = new JSZip();
    const zip = await jszip.loadAsync(file);

    const imagePromises = [];

    zip.forEach((relativePath, zipEntry) => {
      if (/\.(jpe?g|png|gif|bmp)$/i.test(zipEntry.name)) {
        const promise = zipEntry.async("blob").then((blob) => {
          const img = new Image();
          img.src = URL.createObjectURL(blob);
          return new Promise((resolve) => {
            img.onload = () => resolve(new ImageObject(img, file));
          });
        });

        imagePromises.push(promise);
      }
    });

    const images = await Promise.all(imagePromises);
    document.querySelector("canvas").style.display = "block";            
    return images; // returns an array of ImageObjects for all images in the ZIP
} else {
          return []; // to avoid undefined entries in results
        }
      });

      // Flatten the array of arrays (because PDFs return arrays)
      const nestedImages = await Promise.all(loadPromises);
      images = nestedImages.flat();

      currentImageIndex = 0;
      pointsDrawn = false;  // Enable drawing points/lines after switching images

      updateImageSelector();
      loadCurrentImage();

      console.log(fileListPdf);
      if (document.querySelector('#svg-container')) {
        document.querySelector('#svg-container').style.display = "none";
      }

    });    


    function draw() {
      const current = images[currentImageIndex];
      if (!current) {
        return;
      }
      const { img, points } = current;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0); // Draw the image

      current.imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); // Store image data

      // Calculate font size and circle radius based on the image size
      const fontSize = Math.floor(img.width * 0.025); // 5% of the image's width for the font size
      const circleRadius = Math.floor(img.width * 0.018); // 7% of the image's width for the circle radius

      // Draw points and lines if points are set
      if (pointsDrawn) {
        ctx.strokeStyle = "blue";
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        for (let i = 0; i < points.length; i++) {
          const start = points[i];
          const end = points[(i + 1) % points.length];
          ctx.moveTo(start.x, start.y);
          ctx.lineTo(end.x, end.y);
        }
        ctx.stroke();
        ctx.setLineDash([]);

        // Draw corner handles with transparency
        ctx.fillStyle = "red";
        for (let i = 0; i < points.length; i++) {
          const pt = points[i];

          // Set transparency for circles (alpha value)
          ctx.globalAlpha = 0.7; // 70% opacity for the circle points
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, 6, 0, Math.PI * 2);
          ctx.fill();

          // Draw the larger circle in white with transparency
          ctx.fillStyle = "white";
          ctx.beginPath();
          ctx.arc(pt.x, pt.y, circleRadius, 0, Math.PI * 2); // Larger circle to hold the number
          ctx.fill();

          // Reset the alpha value for the text
          ctx.globalAlpha = 1.0;

          // Set the font size and draw the number in black
          ctx.fillStyle = "black";
          ctx.font = `${fontSize}px Arial`; // Set font size dynamically based on image width
          ctx.textAlign = "center"; // Center the text horizontally
          ctx.textBaseline = "middle"; // Center the text vertically
          ctx.fillText(i + 1, pt.x, pt.y); // Position the number in the circle
        }
      }
      //drawGuides();
    }
    /*
        canvas.addEventListener("mousedown", (e) => {
          const current = images[currentImageIndex];
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
    
          for (let pt of current.points) {
            const dx = pt.x - x;
            const dy = pt.y - y;
            if (dx * dx + dy * dy < 100) {
              draggingPoint = pt;
              return;
            }
          }
    
          for (let i = 0; i < current.points.length; i++) {
            const a = current.points[i];
            const b = current.points[(i + 1) % current.points.length];
            if (pointNearLine(x, y, a, b, 6)) {
              draggingPoint = { line: [a, b], dx: x, dy: y };
              return;
            }
          }
        });
    
        canvas.addEventListener("mousemove", (e) => {
          if (!draggingPoint) return;
          const current = images[currentImageIndex];
          const rect = canvas.getBoundingClientRect();
          const x = e.clientX - rect.left;
          const y = e.clientY - rect.top;
    
          if (draggingPoint.line) {
            const [a, b] = draggingPoint.line;
            const dx = x - draggingPoint.dx;
            const dy = y - draggingPoint.dy;
            a.x += dx; a.y += dy;
            b.x += dx; b.y += dy;
            draggingPoint.dx = x;
            draggingPoint.dy = y;
          } else {
            draggingPoint.x = x;
            draggingPoint.y = y;
          }
    
          draw();
        });
    
        canvas.addEventListener("mouseup", () => {
          draggingPoint = null;
        });
        */

    let pointsDrawn = false; // Flag to control if points and lines should be drawn

    warpBtn.addEventListener("click", () => {
      applyPerspectiveWarp();
      pointsDrawn = false;  // Disable drawing points/lines after the warp

      const canvas = document.querySelector("canvas");
      const dataURL = canvas.toDataURL(); // Get canvas image as data URL
      /*
      const tds = document.querySelectorAll("td");
      
      for (let td of tds) {
        if (!td.querySelector("img")) {
          const img = document.createElement("img");
          img.src = dataURL;
          td.appendChild(img);
          break; // Stop after the first match
        }
      }
        */
    });


    imageSelector.addEventListener("change", (e) => {
      // pointsDrawn = true;  // Enable drawing points/lines after switching images
      currentImageIndex = parseInt(e.target.value);
      loadCurrentImage();
    });

    function applyPerspectiveWarp() {
      const current = images[currentImageIndex];
      const [tl, tr, br, bl] = current.points;

      const width = Math.floor(Math.max(distance(tl, tr), distance(bl, br)));
      const height = Math.floor(Math.max(distance(tl, bl), distance(tr, br)));

      const destCanvas = document.createElement("canvas");
      destCanvas.width = width;
      destCanvas.height = height;
      const destCtx = destCanvas.getContext("2d");
      const destImageData = destCtx.createImageData(width, height);

      // Compute homography from dest → src
      const H = computeHomography(
        [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ],
        [tl, tr, br, bl]
      );

      const src = current.imageData.data;
      const srcW = canvas.width;
      const srcH = canvas.height;

      // Warp each pixel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const denom = H[6] * x + H[7] * y + H[8];
          const sx = (H[0] * x + H[1] * y + H[2]) / denom;
          const sy = (H[3] * x + H[4] * y + H[5]) / denom;

          const sxi = Math.floor(sx);
          const syi = Math.floor(sy);

          if (sxi < 0 || syi < 0 || sxi >= srcW || syi >= srcH) continue;

          const srcIdx = (syi * srcW + sxi) * 4;
          const destIdx = (y * width + x) * 4;

          for (let i = 0; i < 4; i++) {
            destImageData.data[destIdx + i] = src[srcIdx + i];
          }
        }
      }

      destCtx.putImageData(destImageData, 0, 0);

      // Replace the current image with warped version
      const newImg = new Image();
      newImg.src = destCanvas.toDataURL();
      newImg.onload = () => {
        images[currentImageIndex] = new ImageObject(newImg);
        loadCurrentImage();
      };
    }

    /* ========= Utility functions ========= */

    function computeHomography(srcPts, dstPts) {
      // Each pair gives 2 equations → 8 equations total
      const A = [];
      const b = [];

      for (let i = 0; i < 4; i++) {
        const { x: x1, y: y1 } = srcPts[i];
        const { x: x2, y: y2 } = dstPts[i];
        A.push([x1, y1, 1, 0, 0, 0, -x2 * x1, -x2 * y1]);
        A.push([0, 0, 0, x1, y1, 1, -y2 * x1, -y2 * y1]);
        b.push(x2);
        b.push(y2);
      }

      const h = solveLinearSystem(A, b);
      // Add the final h33 = 1
      h.push(1);
      return h;
    }

    function solveLinearSystem(A, b) {
      // Gaussian elimination for Ax = b
      const n = A[0].length;
      for (let i = 0; i < n; i++) {
        A[i] = [...A[i], b[i]]; // append RHS
      }

      for (let i = 0; i < n; i++) {
        // Find pivot
        let maxRow = i;
        for (let k = i + 1; k < n; k++) {
          if (Math.abs(A[k][i]) > Math.abs(A[maxRow][i])) maxRow = k;
        }
        [A[i], A[maxRow]] = [A[maxRow], A[i]];

        // Normalize pivot
        const pivot = A[i][i];
        if (Math.abs(pivot) < 1e-10) continue;
        for (let j = i; j <= n; j++) A[i][j] /= pivot;

        // Eliminate other rows
        for (let k = 0; k < n; k++) {
          if (k === i) continue;
          const factor = A[k][i];
          for (let j = i; j <= n; j++) A[k][j] -= factor * A[i][j];
        }
      }

      const x = new Array(n);
      for (let i = 0; i < n; i++) x[i] = A[i][n];
      return x;
    }



    function distance(p1, p2) {
      return Math.hypot(p1.x - p2.x, p1.y - p2.y);
    }

    function pointNearLine(px, py, a, b, threshold) {
      const dx = b.x - a.x;
      const dy = b.y - a.y;
      const lenSq = dx * dx + dy * dy;
      const t = ((px - a.x) * dx + (py - a.y) * dy) / lenSq;
      if (t < 0 || t > 1) return false;
      const projX = a.x + t * dx;
      const projY = a.y + t * dy;
      const distSq = (projX - px) ** 2 + (projY - py) ** 2;
      return distSq < threshold * threshold;
    }

    async function dropHandler(event) {
    //event.preventDefault(); // ✅ Always prevent default first
      // ❌ Ignore drop if it was dropped on an <input>
      if (event.target.tagName === "INPUT") {
        return; // do nothing
      }

      const items = event.dataTransfer.items;

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.kind === 'file') {
          event.preventDefault(); // prevent default only for files

          const file = item.getAsFile();

          if (file.type.startsWith('image/')) {
            await processFile(file);
            console.log("image");
          } else if (file.type === 'application/pdf') {
            fileListPdf.push({ file });
            await processPdf(file, true);
            console.log("pdf");
            setTimeout(editablesvg, 2000);
          } else {
            console.log("ignored file type:", file.type);
          }

        } else if (item.kind === 'string') {
          console.log("text dropped");
          
          if (item.type === 'text/plain') {
                item.getAsString((text) => {

                    const output = document.querySelector("#output");

                    // Split by line breaks (handles Windows + Mac + Linux)
                    const lines = text.split(/\r?\n/);
                    lines.forEach(line => {
                        const div = document.createElement("div");
                        div.textContent = line;
                        //output.appendChild(div);
                    });

                    console.log('Dropped text:', text);
                });
            } 
          // Handle HTML content
          else if (item.type === 'text/html') {
  item.getAsString((html) => {
    console.log('Pasted HTML:', html);
/*
    // Example: append to output div
    const output = document.querySelector("#output");
    const div = document.createElement("div");
    div.innerHTML = html; // be careful with innerHTML if content is untrusted
    output.appendChild(div);*/
  });
}
          
        }
      }
    }

    function updateImageSelector() {
      imageSelector.innerHTML = images.map((_, i) =>
        `<option value="${i}">Image ${i + 1}</option>`
      ).join("");
      imageSelector.value = currentImageIndex;
    }

    function loadCurrentImage() {
  const current = images[currentImageIndex];
  if (!current?.img) return;

  const img = current.img;

  // Ensure image is loaded
  if (!img.complete) {
    img.onload = () => loadCurrentImage();
    return;
  }

  // Normalize to 300 DPI
  const targetDPI = 300;
  const imageDPI = current.dpi || 300;
  const scaleFactor = imageDPI / targetDPI;

  // Calculate canvas size based on physical dimensions
  const displayWidth = img.width / scaleFactor;
  const displayHeight = img.height / scaleFactor;

  const canvas = document.getElementById("canvas");
  canvas.width = displayWidth;
  canvas.height = displayHeight;

  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, canvas.width, canvas.height); // Clear before redraw
  ctx.drawImage(img, 0, 0, displayWidth, displayHeight);

  draw(); // Redraw overlays if any
  canvas.style.display = "block";

  // Setup rotation slider only if images are ready
  if (typeof setupRotationSlider === "function") setupRotationSlider();

  // Setup right-click handler
  canvas.oncontextmenu = handleMagicWandClick;

  // Manage image in printTools container
  const container = document.querySelector("#printTools");
  const imgId = `img-${currentImageIndex}`;
  img.id = imgId;

  const existingImg = container.querySelector(`#${imgId}`);
  if (existingImg) {
    if (existingImg !== img) container.replaceChild(img, existingImg);
  } else {
    container.appendChild(img);
  }
}

    // Process image file dropped or pasted
    function processFile(file) {
      return new Promise((resolve) => {
        const img = new Image();
        img.src = URL.createObjectURL(file);
        img.onload = () => {
          images.push(new ImageObject(img, file));
          currentImageIndex = images.length - 1;
          updateImageSelector();
          loadCurrentImage();
          resolve();
        };
      });
    }

    async function processPdf(file, useTextOverlay = false) {
  const pdfBytes = await file.arrayBuffer();

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes,
    fontExtraProperties: true,
    cMapUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/cmaps/',
    cMapPacked: true,
    standardFontDataUrl: 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/standard_fonts/'
  });

  const pdf = await loadingTask.promise;

  let container;

  if (useTextOverlay) {
    container = document.getElementById('svg-container');

    if (!container) {
      container = document.createElement('div');
      container.id = 'svg-container';
      document.querySelector("#pdfTools").appendChild(container);
      showTab('pdfTools');
    }

    const title = document.createElement('h2');
    title.textContent = file.name || 'Untitled PDF';
    container.appendChild(title);
  }

  for (let pageNum = 1; pageNum <= pdf.numPages; pageNum++) {
    const page = await pdf.getPage(pageNum);

    if (!useTextOverlay) {
      // 👉 Put your normal page processing logic here
      console.log(`Processing page ${pageNum}`);
      continue;
    }

    // ===== SVG + TEXT OVERLAY MODE =====
    const viewport = page.getViewport({ scale: 1 });
    const opList = await page.getOperatorList();
    const svgGfx = new pdfjsLib.SVGGraphics(page.commonObjs, page.objs);
    svgGfx.embedFonts = true;
    svgGfx.fontExtraProperties = true;

    const pageWrapper = document.createElement('div');
    pageWrapper.style.position = 'relative';
    pageWrapper.style.width = `${viewport.width}px`;
    pageWrapper.style.height = `${viewport.height}px`;

    try {
      const svg = await svgGfx.getSVG(opList, viewport);
      svg.style.position = 'absolute';
      pageWrapper.appendChild(svg);

      renderedSVGs.push({
        svgElement: svg,
        fileName: `${file.name.replace(/\.pdf$/i, '')}_page${pageNum}.svg`
      });

    } catch (err) {
      console.warn(`Page ${pageNum} SVG render failed:`, err);
    }

    // ===== TEXT LAYER =====
    const textContent = await page.getTextContent();    
        console.log(textContent);
        let text = textContent.items.map(item => item.str).join("<br>");
        console.log(text);
        if (pdf.numPages<10){
        document.querySelector("#output").innerHTML = text;
        }
    const textLayerDiv = document.createElement('div');
    textLayerDiv.className = 'text-layer';
    textLayerDiv.style.display = "none";
    textLayerDiv.style.width = `${viewport.width}px`;
    textLayerDiv.style.height = `${viewport.height}px`;
    textLayerDiv.style.position = 'absolute';
    textLayerDiv.style.top = '0';
    textLayerDiv.style.left = '0';
    textLayerDiv.style.pointerEvents = 'none';

    for (const item of textContent.items) {
      const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
      const x = transform[4];      
      const y = transform[5]; // flip Y
      const fontSize = Math.hypot(transform[2], transform[3]);

      const span = document.createElement('span');
      span.textContent = item.str;
      span.style.position = 'absolute';
      span.style.left = `${x}px`;
      span.style.top = `${y - fontSize}px`;
      span.style.fontSize = `${fontSize}px`;
      span.style.fontFamily = item.fontName || 'sans-serif';

      textLayerDiv.appendChild(span);
    }

    pageWrapper.appendChild(textLayerDiv);

    const label = document.createElement('h4');
    label.textContent = `Page ${pageNum}`;
    container.appendChild(label);
    container.appendChild(pageWrapper);
  }
}

    document.addEventListener('paste', async (e) => {
      const items = (e.clipboardData || e.originalEvent.clipboardData).items;
      const promises = [];

      for (let i = 0; i < items.length; i++) {
        const item = items[i];

        if (item.kind === 'file') {
          const file = item.getAsFile();
          if (!file) continue;

          if (file.type.startsWith('image/')) {
            promises.push(processFile(file)); // Your existing image handler
          } else if (file.type === 'application/pdf') {
            fileListPdf.push({ file });
            promises.push(processPdf(file, true)); // Your existing PDF handler
          }
        } else if (item.kind === 'string') {
          // Handle plain text
          if (item.type === 'text/plain') {
  promises.push(new Promise((resolve) => {
    item.getAsString((text) => {
            const output = document.querySelector("#output");

      // Split by line breaks (handles Windows + Mac + Linux)
      const lines = text.split(/\r?\n/);

lines.forEach(line => {
  const div = document.createElement("div");
  div.textContent = line;
  output.appendChild(div);
});
      resolve({ type: 'text', content: text });
    });
  }));
}
          // Handle HTML content
          else if (item.type === 'text/html') {
            promises.push(new Promise((resolve) => {
              item.getAsString((html) => {
                console.log('Pasted HTML:', html);
                resolve({ type: 'html', content: html });
              });
            }));
          }
        }
      }

      try {
        const results = await Promise.all(promises);
        console.log('All clipboard items processed:', results);
        // You can now handle results: images, pdfs, text, HTML together

        // Set first PDF file name to input
        if (fileListPdf.length > 0) {
          const firstPdfName = fileListPdf[0].file.name;
          const filenameInput = document.querySelector("#filename");
          if (filenameInput) {
            filenameInput.value = firstPdfName;
            console.log('First PDF filename set to input:', firstPdfName);
          }
        }

      } catch (error) {
        console.error('Error processing clipboard items:', error);
      }

      console.log('PDF files so far:', fileListPdf);
    }, false);


    async function handleClipboardFiles(files) {
      const promises = [];

      for (const file of files) {
        if (file.type.startsWith('image/')) {
          promises.push(processFile(file));
        } else if (file.type === 'application/pdf') {
          fileListPdf.push({ file });
          promises.push(processPdf(file, true));
        }
      }

      try {
        await Promise.all(promises);
        console.log('✅ All files processed:', files);
      } catch (error) {
        console.error('❌ Error processing files:', error);
      }
    }

    // 🧩 Handle button click (secure clipboard access)
    document.querySelector("#pastebutton").addEventListener('click', async () => {
      try {
        const clipboardItems = await navigator.clipboard.read();
        const files = [];

        for (const clipboardItem of clipboardItems) {
          for (const type of clipboardItem.types) {
            const blob = await clipboardItem.getType(type);

// Handle text
        if (type === 'text/plain') {
          const blob = await clipboardItem.getType(type);          
          document.querySelector("#output").innerHTML +=await blob.text();
        }


            // Only handle images or PDFs
            if (type.startsWith('image/') || type === 'application/pdf') {
              const extension = type.split('/')[1] || 'bin';
              const file = new File([blob], `clipboard_${Date.now()}.${extension}`, { type });
              files.push(file);
            }
          }
        }

        if (files.length > 0) {
          await handleClipboardFiles(files);
        }
        //else {
          //alert('No supported files (image/pdf) found in clipboard.');
        //}
      } catch (err) {
        console.error('❌ Clipboard read failed:', err);
        alert('Clipboard access not allowed or not supported in this browser.');
      }
    });


    // Attach drop and dragover event listeners
    document.body.addEventListener("dragover", (e) => {
// Allow normal behavior inside contenteditable
  if (e.target.closest('[contenteditable="true"]')) {
    return;
  }

  // Only prevent default for file drops
  if (e.dataTransfer.types.includes("Files")) {
    e.preventDefault();
  }
});
    
    const rotateBtn = document.querySelector("#rotate");

let isRotating = false;

rotateBtn?.addEventListener("click", async () => {
  if (isRotating) return; // prevent double clicks
  isRotating = true;

  try {
    await rotateCurrentImage();
  } catch (err) {
    console.error("Rotation failed:", err);
  } finally {
    isRotating = false;
  }
});

async function rotateCurrentImage() {
  if (!canvas || !ctx) throw new Error("Canvas not initialized");
  if (!images?.length) throw new Error("No images available");

  const current = images[currentImageIndex];
  if (!current) throw new Error("Invalid current image");

  return new Promise((resolve, reject) => {
    try {
      const oldWidth = canvas.width;
      const oldHeight = canvas.height;

      // Save canvas to offscreen canvas (more efficient than DOM canvas)
      const offscreen = document.createElement("canvas");
      offscreen.width = oldWidth;
      offscreen.height = oldHeight;

      const offCtx = offscreen.getContext("2d");
      if (!offCtx) throw new Error("Could not get offscreen context");

      offCtx.drawImage(canvas, 0, 0);

      // Resize main canvas
      canvas.width = oldHeight;
      canvas.height = oldWidth;

      // Rotate 90° clockwise
      ctx.save();
      ctx.translate(canvas.width, 0);
      ctx.rotate(Math.PI / 2);
      ctx.drawImage(offscreen, 0, 0);
      ctx.restore();

      // Rotate points correctly using old dimensions
      const rotatedPoints = (current.points || []).map(pt => ({
        x: oldHeight - pt.y,
        y: pt.x
      }));

      // Create new image from rotated canvas
      const newImg = new Image();
      newImg.src = canvas.toDataURL();

      newImg.onload = () => {
        try {
          const imgObj = new ImageObject(newImg);
          imgObj.points = rotatedPoints;

          images[currentImageIndex] = imgObj;

          // Cleanup old state only after success
          resolve();
        } catch (e) {
          reject(e);
        }
      };

      newImg.onerror = reject;

    } catch (error) {
      reject(error);
    }
  });
}



    const removePointsBtn = document.getElementById("removePointsBtn");

    let pointsVisible = true; // Initially assume points are visible

    // Toggle points visibility on button click
    removePointsBtn.addEventListener("click", () => {
      const current = images[currentImageIndex];

      if (pointsVisible) {
        current.hiddenPoints = current.points; // Temporarily store current points
        current.points = []; // Clear points
        pointsDrawn = false;
        removePointsBtn.textContent = "Show Points"; // Update button label
      } else {
        current.points = current.hiddenPoints || []; // Restore points
        pointsDrawn = true;
        removePointsBtn.textContent = "Remove Points"; // Update button label
      }

      pointsVisible = !pointsVisible; // Toggle the state
      draw(); // Redraw the canvas
    });


    function drawSelectionRectangle() {
      if (!rectStart || !rectEnd) return;
      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 255, 0.6)';
      ctx.lineWidth = 2;
      ctx.setLineDash([4, 2]);
      ctx.strokeRect(
        Math.min(rectStart.x, rectEnd.x),
        Math.min(rectStart.y, rectEnd.y),
        Math.abs(rectStart.x - rectEnd.x),
        Math.abs(rectStart.y - rectEnd.y)
      );
      ctx.restore();
    }

    let drawingRectangle = false;
    let rectStart = null;
    let rectEnd = null;
    let lockAspectRatio = false;
    let mousePosition = null;


    let browserZoom = 1; // your browser zoom scale
    function getBrowserZoom() {
      return parseFloat(getComputedStyle(document.body).zoom) || 1;
    }

    function fixMouse(e) {
      const rect = canvas.getBoundingClientRect();

      // CSS mouse position relative to canvas
      const cssX = e.clientX - rect.left;
      const cssY = e.clientY - rect.top;

      // Ratio of internal canvas size vs displayed size
      const scaleX = canvas.width / rect.width;
      const scaleY = canvas.height / rect.height;

      return {
        x: cssX * scaleX,
        y: cssY * scaleY
      };
    }


    // Change cursor when entering/leaving canvas
    canvas.addEventListener("mouseenter", () => {
      canvas.style.cursor = "crosshair"; // crosshair when inside
    });

    canvas.addEventListener("mouseleave", () => {
      canvas.style.cursor = "default"; // normal cursor outside
    });

    canvas.addEventListener("mouseleave", () => {
      mousePosition = null;
      draw(); // Redraw without guides
    });

    canvas.addEventListener("mousedown", (e) => {
      const current = images[currentImageIndex];
      const m = fixMouse(e);
      const x = m.x;
      const y = m.y;

      draggingPoint = null;

      for (let pt of current.points) {
        const dx = pt.x - x;
        const dy = pt.y - y;
        if (dx * dx + dy * dy < 100) {
          draggingPoint = pt;
          return;
        }
      }

      for (let i = 0; i < current.points.length; i++) {
        const a = current.points[i];
        const b = current.points[(i + 1) % current.points.length];
        if (pointNearLine(x, y, a, b, 6)) {
          draggingPoint = { line: [a, b], dx: x, dy: y };
          return;
        }
      }

      if (e.shiftKey) {
        rectStart = { x, y };
        rectEnd = { x, y };
        drawingRectangle = true;
        lockAspectRatio = e.ctrlKey;
      }
    });


    canvas.addEventListener("dblclick", (e) => {
      const m = fixMouse(e);
      const x = m.x;
      const y = m.y;

      rectStart = { x, y };
      rectEnd = { x, y };
      drawingRectangle = true;
      lockAspectRatio = e.ctrlKey;
    });



    canvas.addEventListener("mousemove", (e) => {
      const m = fixMouse(e);
      const x = m.x;
      const y = m.y;

      mousePosition = { x, y };

      if (draggingPoint) {
        const current = images[currentImageIndex];
        if (draggingPoint.line) {
          const [a, b] = draggingPoint.line;
          const dx = x - draggingPoint.dx;
          const dy = y - draggingPoint.dy;
          a.x += dx; a.y += dy;
          b.x += dx; b.y += dy;
          draggingPoint.dx = x;
          draggingPoint.dy = y;
        } else {
          draggingPoint.x = x;
          draggingPoint.y = y;
        }
        canvas.style.cursor = "grabbing";
        draw();
        
      }

      if (drawingRectangle) {
        let x2 = x;
        let y2 = y;

        if (lockAspectRatio) {
          const ratio = 35 / 45;
          const dx = x - rectStart.x;
          const dy = y - rectStart.y;
          if (Math.abs(dx) > Math.abs(dy)) {
            x2 = rectStart.x + dx;
            y2 = rectStart.y + (Math.sign(dx) * Math.abs(dx)) / ratio;
          } else {
            y2 = rectStart.y + dy;
            x2 = rectStart.x + (Math.sign(dy) * Math.abs(dy)) * ratio;
          }
        }

        rectEnd = { x: x2, y: y2 };
      }

      draw();
      drawSelectionRectangle();

      if (e.shiftKey) {
        drawGuides();
      }
      // 🔍 zoom helper
  //drawZoomHelper(x, y);
    });

    function drawZoomHelper(mx, my) {
  const zoom = 5;
  const size = 40;
  const padding = 10;

  const destW = size * zoom;
  const destH = size * zoom;

  // Default position (bottom-right of cursor)
  let dx = mx + padding;
  let dy = my + padding;

  // Clamp to canvas bounds
  if (dx + destW > canvas.width) {
    dx = mx - padding - destW;
  }
  if (dy + destH > canvas.height) {
    dy = my - padding - destH;
  }

  // Final safety clamp (in case cursor is near edges)
  dx = Math.max(0, Math.min(dx, canvas.width - destW));
  dy = Math.max(0, Math.min(dy, canvas.height - destH));

  ctx.save();
  ctx.imageSmoothingEnabled = false;

  ctx.drawImage(
    canvas,
    mx - size / 2,
    my - size / 2,
    size,
    size,
    dx,
    dy,
    destW,
    destH
  );

  ctx.strokeStyle = "limegreen";
  ctx.lineWidth = 2;
  ctx.strokeRect(dx, dy, destW, destH);

  ctx.restore();
}




    canvas.addEventListener("mouseup", () => {
      if (drawingRectangle && rectStart && rectEnd) {
        const current = images[currentImageIndex];

        // Define corners in clockwise order: TL, TR, BR, BL
        const x1 = rectStart.x;
        const y1 = rectStart.y;
        const x2 = rectEnd.x;
        const y2 = rectEnd.y;

        current.points = [
          { x: Math.min(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.max(y1, y2) },
          { x: Math.min(x1, x2), y: Math.max(y1, y2) }
        ];

        pointsDrawn = true;
        rectStart = rectEnd = null;
        drawingRectangle = false;
        lockAspectRatio = false;
        draw();
      }

      draggingPoint = null;
    });

    function drawGuides() {
      if (!mousePosition) return;

      ctx.save();
      ctx.strokeStyle = 'rgba(0, 0, 0, 0.3)';
      ctx.lineWidth = 2;
      ctx.setLineDash([5, 5]);

      ctx.beginPath();
      ctx.moveTo(mousePosition.x, 0);
      ctx.lineTo(mousePosition.x, canvas.height);
      ctx.stroke();

      ctx.beginPath();
      ctx.moveTo(0, mousePosition.y);
      ctx.lineTo(canvas.width, mousePosition.y);
      ctx.stroke();

      ctx.restore();
    }

    function sharpenImage() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;

      // Sharpening kernel
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];

      const newData = new Uint8ClampedArray(data.length);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0;

          // Apply the kernel
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const pixelX = x + kx;
              const pixelY = y + ky;
              const pixelIndex = ((pixelY * width) + pixelX) * 4;

              if (pixelX >= 0 && pixelX < width && pixelY >= 0 && pixelY < height) {
                const kernelValue = kernel[(ky + 1) * 3 + (kx + 1)];
                r += data[pixelIndex] * kernelValue;
                g += data[pixelIndex + 1] * kernelValue;
                b += data[pixelIndex + 2] * kernelValue;
              }
            }
          }

          const newPixelIndex = (y * width + x) * 4;
          newData[newPixelIndex] = Math.min(255, Math.max(0, r));     // Red
          newData[newPixelIndex + 1] = Math.min(255, Math.max(0, g)); // Green
          newData[newPixelIndex + 2] = Math.min(255, Math.max(0, b)); // Blue
          newData[newPixelIndex + 3] = data[newPixelIndex + 3];       // Alpha
        }
      }

      // Update the canvas with the new image data
      const newImageData = new ImageData(newData, width, height);
      ctx.putImageData(newImageData, 0, 0);
      window.image = newImageData;
    }

    const sharpen = (ctx, w, h, mix) => {
      var x, sx, sy, r, g, b, a, dstOff, srcOff, wt, cx, cy, scy, scx,
        weights = [0, -1, 0, -1, 5, -1, 0, -1, 0],
        katet = Math.round(Math.sqrt(weights.length)),
        half = (katet * 0.5) | 0,
        dstData = ctx.createImageData(w, h),
        dstBuff = dstData.data,
        srcBuff = ctx.getImageData(0, 0, w, h).data,
        y = h;
      while (y--) {
        x = w;
        while (x--) {
          sy = y;
          sx = x;
          dstOff = (y * w + x) * 4;
          r = 0;
          g = 0;
          b = 0;
          a = 0;
          if (x > 0 && y > 0 && x < w - 1 && y < h - 1) {
            for (cy = 0; cy < katet; cy++) {
              for (cx = 0; cx < katet; cx++) {
                scy = sy + cy - half;
                scx = sx + cx - half;

                if (scy >= 0 && scy < h && scx >= 0 && scx < w) {
                  srcOff = (scy * w + scx) * 4;
                  wt = weights[cy * katet + cx];

                  r += srcBuff[srcOff] * wt;
                  g += srcBuff[srcOff + 1] * wt;
                  b += srcBuff[srcOff + 2] * wt;
                  a += srcBuff[srcOff + 3] * wt;
                }
              }
            }

            dstBuff[dstOff] = r * mix + srcBuff[dstOff] * (1 - mix);
            dstBuff[dstOff + 1] = g * mix + srcBuff[dstOff + 1] * (1 - mix);
            dstBuff[dstOff + 2] = b * mix + srcBuff[dstOff + 2] * (1 - mix);
            dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
          } else {
            dstBuff[dstOff] = srcBuff[dstOff];
            dstBuff[dstOff + 1] = srcBuff[dstOff + 1];
            dstBuff[dstOff + 2] = srcBuff[dstOff + 2];
            dstBuff[dstOff + 3] = srcBuff[dstOff + 3];
          }
        }
      }

      ctx.putImageData(dstData, 0, 0);
    }

    /*
    document.querySelector('#sharpenImage').addEventListener("click", function(){
    sharpenImage();  
  })
    */

    document.querySelector('#sharpenImage').addEventListener("click", function () {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      sharpen(ctx, canvas.width, canvas.height, 1.0);  // Full sharpening (mix = 1.0)
    });

    document.querySelector('#print').addEventListener("click", function () {
      zoomLevel = 1;
      document.body.style.zoom = zoomLevel;
      window.print();
    });

    document.querySelector("#oneidcard").addEventListener("click", function () {
      document.querySelectorAll("img").forEach(function (e) {
        e.style.width = "3.4in";
        e.style.height = "2.2in";
      });
      document.querySelector("table").style.margin = "0 auto";
      document.querySelector("table").style.borderSpacing = "45px 15px";
      document.querySelector("table").style.pageBreakAfter = "always";

      // Clone the table node
      const clonedNode = document.querySelector('#array table').cloneNode(true);
      // Set padding style
      clonedNode.style.paddingTop = '0.1in';
      // Append the cloned node
      document.querySelector("#array").appendChild(clonedNode);

      document.querySelectorAll("#array table:nth-child(1) tr td:nth-child(1) img").forEach(function (e) {
        e.parentElement.style.width = "3.4in";
        e.remove();

      });

      let imgs = document.querySelectorAll("#array table:nth-child(1) td:nth-child(2) img");

      for (let i = 0; i < Math.ceil((imgs.length - 1) / 2); i++) {
        let tds = document.querySelectorAll("#array table:nth-child(1) td:nth-child(1)");
        let emptyTd = Array.from(tds).find(td => !td.querySelector("img"));
        if (emptyTd) {
          emptyTd.replaceChildren(imgs[imgs.length - 1 - i]);
        }
      }

      document.querySelectorAll("#array table:last-child tr td:nth-child(2) img").forEach(function (e) {
        e.parentElement.style.width = "3.4in";
        e.remove();
        //e.parentElement.replaceChildren(e.closest("tr").nextElementSibling.querySelector("td:nth-child(1) img"))
      });

      let imgs1 = document.querySelectorAll("#array table:nth-of-type(2) td:nth-child(1) img");

      for (let i = 0; i < Math.ceil((imgs1.length - 1) / 2); i++) {
        let tds = document.querySelectorAll("#array table:nth-of-type(2) td:nth-child(2)");
        let emptyTd = Array.from(tds).find(td => !td.querySelector("img"));
        if (emptyTd) {
          emptyTd.replaceChildren(imgs1[imgs1.length - 1 - i]);
        }
      }

    })

    document.querySelector('#idcard').addEventListener("click", async function () {
      //await generatePortraitPDF();

      const tds = document.querySelectorAll("#array table td");

images.forEach(function (e, index) {
    if (tds[index]) {
        tds[index].innerHTML = `<img src="${e.img.src}" style="width:3.4in; height:2.2in;">`;
    }
});
      
      document.querySelector("table").style.margin = "0 auto";
      document.querySelector("table").style.borderSpacing = "45px 15px";
      document.querySelector("table").style.pageBreakAfter = "always";

      // Ask the user
      const printType = confirm("Click OK for double-sided printing, or Cancel for single-sided printing.");

      if (printType) {
        // Clone the table node
        const clonedNode = document.querySelector('#array table').cloneNode(true);

        // Set padding style
        clonedNode.style.paddingTop = '0.1in';

        // Append the cloned node
        await document.querySelector("#array").appendChild(clonedNode);

        window.print();
      } else {
        window.print();
        window.print();
      }

    });

    document.querySelector('#idcardstacked').addEventListener("click", function () {

      const table = document.querySelector("table");
      table.style.margin = "0 auto";
      table.style.marginTop = "0.1in";
      //table.style.borderSpacing = "20px";

      // Resize all images
      document.querySelectorAll("img").forEach(function (e) {
        e.style.width = "3.4in";
        e.style.height = "2.2in";
      });

      document.querySelectorAll("#array img").forEach((img, index) => {
        document.querySelectorAll("#array td:nth-child(1)")[index].appendChild(img);
      });

      document.querySelectorAll("#array td:nth-child(2)").forEach(function (e) {
        e.remove();
      })

      document.querySelectorAll("img")[1].style.scale = "-1";

    });

    // Declare `dirHandle` as a global variable.
    let dirHandle;

    document.querySelector('#resizeimage').addEventListener("click", async function () {
      if (document.querySelector('.selected')) {
        document.querySelector('.selected').style.outline = '';

        const selectedImg = document.querySelector('.selected');
        images.push(new ImageObject(selectedImg, selectedImg.file || null));

        document.querySelector('.selected').classList.remove('selected');
        currentImageIndex = images.length - 1;
        images[currentImageIndex].points = []; // Clear points
        pointsDrawn = false;  // Enable drawing points/lines after switching images

        updateImageSelector();
        loadCurrentImage();
      }

      const originalCanvas = document.querySelector('canvas');
      const input = document.querySelector("#filename");
      const targetSizeKB = parseFloat(input.value) - 0.2;  // Assuming input is a number

      function resizeCanvas(canvas, scale) {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = canvas.width * scale;
        tempCanvas.height = canvas.height * scale;
        const ctx = tempCanvas.getContext('2d');
        ctx.drawImage(canvas, 0, 0, tempCanvas.width, tempCanvas.height);
        return tempCanvas;
      }

      function getJPEGBlob(canvas, quality, callback) {
        canvas.toBlob((blob) => {
          callback(blob);
        }, 'image/jpeg', quality);
      }

      function findBestJPEGQuality(canvas, targetKB, callback) {
        let low = 0.1;
        let high = 1.0;
        let iterations = 10;
        let i = 0;

        function next() {
          if (i >= iterations) {
            getJPEGBlob(canvas, (low + high) / 2, callback);
            return;
          }

          const mid = (low + high) / 2;

          getJPEGBlob(canvas, mid, (blob) => {
            const sizeKB = blob.size / 1024;
            console.log(
              "Quality " + mid.toFixed(2) + " → " + sizeKB.toFixed(2) + "KB"
            );

            if (sizeKB > targetKB) {
              high = mid;
            } else {
              low = mid;
            }

            i++;
            next();
          });
        }

        next();
      }

      // Slightly resize canvas (e.g., 90%)
      const resizedCanvas = resizeCanvas(originalCanvas, 0.9);

      // Then compress to JPEG to reach target file size
      findBestJPEGQuality(resizedCanvas, targetSizeKB, async (blob) => {
        const finalSizeKB = (blob.size / 1024).toFixed(2);
        console.log("✅ Final size: " + finalSizeKB + " KB");

        // First check if `dirHandle` is in localStorage
        if (!dirHandle) {
          try {
            // Check if the `dirHandle` exists in localStorage
            const storedHandle = localStorage.getItem('dirHandle');
            if (storedHandle) {
              // If the handle exists, retrieve it and parse it
              dirHandle = JSON.parse(storedHandle);
            } else {
              // Request the directory picker if not available
              const handle = await window.showDirectoryPicker();
              const permission = await handle.requestPermission({ mode: 'readwrite' });

              if (permission === 'granted') {
                dirHandle = handle;
                // Store the `dirHandle` in localStorage for future use
                localStorage.setItem('dirHandle', JSON.stringify(dirHandle));
              } else {
                console.log('Permission denied.');
                return;
              }
            }
          } catch (err) {
            console.log(`Error: ${err.message}`);
            return;
          }
        }

        // Save the optimized image file to the selected directory
        try {
          const fileHandle = await dirHandle.getFileHandle(`${Date.now()}.jpg`, { create: true });
          const writable = await fileHandle.createWritable();
          await writable.write(blob);
          await writable.close();
          console.log('File written: optimized_canvas_image.jpg');
        } catch (err) {
          console.log(`Error writing file: ${err.message}`);
        }
      });
    });

    // Listen for the beforeunload event to clear the localStorage entry when the page is closed
    window.addEventListener('beforeunload', () => {
      localStorage.removeItem('dirHandle');
      console.log("✅ Removed dirHandle from localStorage on page close.");
    });

    // Utility to get touch coordinates
    function getTouchPos(touch, canvas) {
      const rect = canvas.getBoundingClientRect();
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    }

    canvas.addEventListener("touchstart", (e) => {
      if (e.touches.length > 1) return; // Ignore multi-touch
      const touch = e.touches[0];
      const pos = getTouchPos(touch, canvas);

      const current = images[currentImageIndex];
      draggingPoint = null;

      for (let pt of current.points) {
        const dx = pt.x - pos.x;
        const dy = pt.y - pos.y;
        if (dx * dx + dy * dy < 100) {
          draggingPoint = pt;
          return;
        }
      }

      for (let i = 0; i < current.points.length; i++) {
        const a = current.points[i];
        const b = current.points[(i + 1) % current.points.length];
        if (pointNearLine(pos.x, pos.y, a, b, 6)) {
          draggingPoint = { line: [a, b], dx: pos.x, dy: pos.y };
          return;
        }
      }

      // Start rectangle selection if user taps while holding shiftKey (won't work on mobile)
      rectStart = pos;
      rectEnd = pos;
      drawingRectangle = true;

      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("touchmove", (e) => {
      if (e.touches.length > 1) return;
      const touch = e.touches[0];
      const pos = getTouchPos(touch, canvas);

      if (draggingPoint) {
        const current = images[currentImageIndex];
        if (draggingPoint.line) {
          const [a, b] = draggingPoint.line;
          const dx = pos.x - draggingPoint.dx;
          const dy = pos.y - draggingPoint.dy;
          a.x += dx;
          a.y += dy;
          b.x += dx;
          b.y += dy;
          draggingPoint.dx = pos.x;
          draggingPoint.dy = pos.y;
        } else {
          draggingPoint.x = pos.x;
          draggingPoint.y = pos.y;
        }
        draw();
      }

      if (drawingRectangle) {
        rectEnd = pos;
        draw();
        drawSelectionRectangle();
      }

      e.preventDefault();
    }, { passive: false });

    canvas.addEventListener("touchend", () => {
      if (drawingRectangle && rectStart && rectEnd) {
        const current = images[currentImageIndex];
        const x1 = rectStart.x;
        const y1 = rectStart.y;
        const x2 = rectEnd.x;
        const y2 = rectEnd.y;

        current.points = [
          { x: Math.min(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.min(y1, y2) },
          { x: Math.max(x1, x2), y: Math.max(y1, y2) },
          { x: Math.min(x1, x2), y: Math.max(y1, y2) }
        ];

        pointsDrawn = true;
        rectStart = rectEnd = null;
        drawingRectangle = false;
        draw();
      }

      draggingPoint = null;
    });

    function applyContrastStretching(brighten = false) {
      const canvas1 = document.getElementById("canvas");
      const ctx1 = canvas1.getContext("2d");

      const originalImage = ctx1.getImageData(0, 0, canvas1.width, canvas1.height);

      const imgData = new ImageData(
        new Uint8ClampedArray(originalImage.data),
        originalImage.width,
        originalImage.height
      );
      const data = imgData.data;

      // Find min and max for each color channel separately
      let minR = 255, maxR = 0;
      let minG = 255, maxG = 0;
      let minB = 255, maxB = 0;

      for (let i = 0; i < data.length; i += 4) {
        if (data[i] < minR) minR = data[i];
        if (data[i] > maxR) maxR = data[i];
        if (data[i + 1] < minG) minG = data[i + 1];
        if (data[i + 1] > maxG) maxG = data[i + 1];
        if (data[i + 2] < minB) minB = data[i + 2];
        if (data[i + 2] > maxB) maxB = data[i + 2];
      }

      // Stretch contrast and optionally brighten for each channel
      for (let i = 0; i < data.length; i += 4) {
        // Stretch R
        let stretchedR = ((data[i] - minR) / (maxR - minR)) * 255;
        // Stretch G
        let stretchedG = ((data[i + 1] - minG) / (maxG - minG)) * 255;
        // Stretch B
        let stretchedB = ((data[i + 2] - minB) / (maxB - minB)) * 255;

        if (brighten) {
          stretchedR = Math.min(stretchedR * 1.2, 255);
          stretchedG = Math.min(stretchedG * 1.2, 255);
          stretchedB = Math.min(stretchedB * 1.2, 255);
        }

        data[i] = stretchedR;
        data[i + 1] = stretchedG;
        data[i + 2] = stretchedB;
      }

      // Create mask for text pixels using luminance (for mask only)
      const width = imgData.width;
      const height = imgData.height;
      const mask = new Uint8Array(width * height);

      // Use luminance for text detection: 0.299 R + 0.587 G + 0.114 B
      // Also check local contrast (3x3 neighborhood) on luminance

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const R = data[idx];
          const G = data[idx + 1];
          const B = data[idx + 2];

          const luminance = 0.299 * R + 0.587 * G + 0.114 * B;

          // Local min/max luminance for contrast
          let localMin = 255, localMax = 0;
          for (let ny = Math.max(0, y - 1); ny <= Math.min(height - 1, y + 1); ny++) {
            for (let nx = Math.max(0, x - 1); nx <= Math.min(width - 1, x + 1); nx++) {
              const nidx = (ny * width + nx) * 4;
              const nR = data[nidx];
              const nG = data[nidx + 1];
              const nB = data[nidx + 2];
              const nLum = 0.299 * nR + 0.587 * nG + 0.114 * nB;
              if (nLum < localMin) localMin = nLum;
              if (nLum > localMax) localMax = nLum;
            }
          }

          const localContrast = localMax - localMin;

          // Thresholds for text pixels
          mask[y * width + x] = (luminance < 40 && localContrast > 30) ? 1 : 0;
        }
      }

      // Darken text pixels by scaling down their RGB values (preserve color)
      for (let i = 0; i < data.length; i += 4) {
        const maskValue = mask[i / 4];
        if (maskValue) {
          data[i] = data[i] * 0.5;
          data[i + 1] = data[i + 1] * 0.5;
          data[i + 2] = data[i + 2] * 0.5;
        }
      }

      // Sharpen kernel
      const sharpenKernel = [
        -1, -1, -1,
        -1, 9, -1,
        -1, -1, -1
      ];

      // Apply selective sharpening twice on masked text pixels
      convolveSelective(imgData, sharpenKernel, 3, mask);
      convolveSelective(imgData, sharpenKernel, 3, mask);

      ctx1.putImageData(imgData, 0, 0);
    }


    // Selective convolution (unchanged)
    function convolveSelective(imageData, kernel, kernelSize, mask) {
      const side = kernelSize;
      const halfSide = Math.floor(side / 2);

      const src = imageData.data;
      const sw = imageData.width;
      const sh = imageData.height;

      const output = new Uint8ClampedArray(src.length);

      for (let y = 0; y < sh; y++) {
        for (let x = 0; x < sw; x++) {
          const idx = y * sw + x;

          if (mask[idx]) {
            let r = 0, g = 0, b = 0;

            for (let ky = 0; ky < side; ky++) {
              for (let kx = 0; kx < side; kx++) {
                const posX = x + kx - halfSide;
                const posY = y + ky - halfSide;

                if (posX >= 0 && posX < sw && posY >= 0 && posY < sh) {
                  const offset = (posY * sw + posX) * 4;
                  const weight = kernel[ky * side + kx];

                  r += src[offset] * weight;
                  g += src[offset + 1] * weight;
                  b += src[offset + 2] * weight;
                }
              }
            }

            const dstOffset = idx * 4;
            output[dstOffset] = Math.min(Math.max(r, 0), 255);
            output[dstOffset + 1] = Math.min(Math.max(g, 0), 255);
            output[dstOffset + 2] = Math.min(Math.max(b, 0), 255);
            output[dstOffset + 3] = src[dstOffset + 3];
          } else {
            // Copy original pixel for non-text pixels
            const srcOffset = idx * 4;
            output[srcOffset] = src[srcOffset];
            output[srcOffset + 1] = src[srcOffset + 1];
            output[srcOffset + 2] = src[srcOffset + 2];
            output[srcOffset + 3] = src[srcOffset + 3];
          }
        }
      }

      // Copy output back to imageData
      for (let i = 0; i < src.length; i++) {
        src[i] = output[i];
      }
    }

    document.querySelectorAll("#canvastoimage").forEach(function (e) {
      e.addEventListener("click", function (e) {
        pointsDrawn = false;
        //draw();

        const canvas = document.querySelector("canvas");
        const imgData = canvas.toDataURL();
        const img = document.createElement("img");
        img.src = imgData;

        const tbody = document.querySelector("table tbody"); // Use tbody instead of table
        const tds = document.querySelectorAll("table td");

        let placed = false;

        for (let td of tds) {
          if (!td.querySelector("img")) {
            td.appendChild(img);
            placed = true;
            break; // Stop after placing the image
          }
        }

        // If image wasn't placed, add a new row to tbody
        if (!placed) {
          const newRow = document.createElement("tr");

          const td1 = document.createElement("td");
          td1.appendChild(img); // Place the image here

          const td2 = document.createElement("td");

          newRow.appendChild(td1);
          newRow.appendChild(td2);

          tbody.appendChild(newRow); // Append to tbody
        }


        const imgs = document.querySelectorAll('#array table td img');

        imgs.forEach(img => {
          const wrapper = img.parentNode; // Use <td> as the wrapper
          wrapper.style.position = 'relative'; // Ensure relative positioning

          // Only add the buttons if they don't already exist
          if (!wrapper.querySelector('.edit-btn') && !wrapper.querySelector('.select-btn')) {
            // Create edit button
            const editBtn = document.createElement('button');
            editBtn.textContent = '✎';
            editBtn.className = 'edit-btn';
            Object.assign(editBtn.style, {
              position: 'absolute',
              top: '2px',
              left: '2px',
              width: '22px',
              height: '22px',
              backgroundColor: 'rgba(0, 123, 255, 0.85)', // Blue
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '14px',
              cursor: 'pointer',
              display: 'none',
              padding: '0',
              lineHeight: '22px',
              textAlign: 'center',
              userSelect: 'none',
              zIndex: '10',
            });

            // Create select button
            const selBtn = document.createElement('button');
            selBtn.textContent = '✓';
            selBtn.className = 'select-btn';
            Object.assign(selBtn.style, {
              position: 'absolute',
              top: '2px',
              right: '2px',
              width: '22px',
              height: '22px',
              backgroundColor: 'rgba(0, 128, 0, 0.85)', // Green
              border: 'none',
              borderRadius: '50%',
              color: 'white',
              fontWeight: 'bold',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'none',
              padding: '0',
              lineHeight: '22px',
              textAlign: 'center',
              userSelect: 'none',
              zIndex: '10',
            });

            wrapper.appendChild(editBtn);
            wrapper.appendChild(selBtn);

            // Show buttons on hover
            wrapper.addEventListener('mouseenter', () => {
              editBtn.style.display = 'block';
              selBtn.style.display = 'block';
            });
            wrapper.addEventListener('mouseleave', () => {
              editBtn.style.display = 'none';
              selBtn.style.display = 'none';
            });

            // Edit button click
            editBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              alert('Edit action for this image');
              // 🔹 Replace with your edit modal / crop / editor logic
            });

            // Select button click
            selBtn.addEventListener('click', (e) => {
              e.stopPropagation();
              // Toggle "selected" state with outline
              if (img.classList.contains('selected')) {
                img.classList.remove('selected');
                img.style.outline = '';
              } else {
                img.classList.add('selected');
                img.style.outline = '3px solid limegreen';
              }
            });
          }

          // Make img draggable
          img.setAttribute('draggable', true);
          /*
            img.addEventListener('dragstart', (e) => {
              e.dataTransfer.setData('text/plain', e.target.src);
              e.dataTransfer.effectAllowed = 'move';
              e.target.classList.add('dragging');
            });
            */

          img.addEventListener('dragstart', async (e) => {
            const img = e.target;
            const url = img.src;

            try {
              const response = await fetch(url);
              const blob = await response.blob();

              // 🔁 Generate a unique filename:
              const ext = blob.type.split('/')[1] || 'png'; // e.g. "jpeg", "png"

              // Example 1: Use timestamp
              const filename = `image-${Date.now()}.${ext}`;

              // Example 2: Use image index (optional, if you're looping)
              // const index = [...document.querySelectorAll('img')].indexOf(img);
              // const filename = `photo-${index}.${ext}`;

              // Example 3: Use data attribute (e.g. <img data-filename="cat1.png">)
              // const filename = img.getAttribute('data-filename') || `image-${Date.now()}.${ext}`;

              // Add file info so dragging out downloads the image
              e.dataTransfer.setData('DownloadURL', `${blob.type}:${filename}:${url}`);

              e.dataTransfer.setData('text/plain', url); // Still used for internal swapping
              e.dataTransfer.setDragImage(img, 0, 0);    // Optional
              img.classList.add('dragging');
            } catch (error) {
              console.error('Failed to fetch image blob:', error);
            }
          });

          img.addEventListener('dragend', (e) => {
            e.target.classList.remove('dragging');
          });

          // Allow dropping on the image
          img.addEventListener('dragover', (e) => {
            e.preventDefault();
            e.dataTransfer.dropEffect = 'move';
          });

          img.addEventListener('drop', (e) => {
            e.preventDefault();
            const draggedSrc = e.dataTransfer.getData('text/plain');
            const target = e.target;
            const draggedImg = [...document.querySelectorAll('#array table td img')].find(i => i.src === draggedSrc);

            if (draggedImg && draggedImg !== target) {
              // Swap the src attributes of the dragged and target images
              const tempSrc = target.src;
              target.src = draggedImg.src;
              draggedImg.src = tempSrc;
            }
          });
        });
      })
    })

    document.getElementById('generatePdf').addEventListener('click', async () => {
      const fileList = [];

      let domImages = document.querySelectorAll('.selected');

      domImages.forEach(function (e) {
        e.classList.remove('selected');
        e.style.outline = '';
      })


      if (domImages.length === 0) {
        domImages = document.querySelectorAll('img');
      }

      domImages.forEach(img => {
        if (img.src) {
          fileList.push({ type: 'imageElement', element: img });
        }
      });

      // If no <img> in DOM, fallback to images[] array
      if (fileList.length === 0 && typeof images !== 'undefined' && images.length > 0) {
        images.forEach(imageObj => {
          fileList.push({ type: 'imageElement', element: imageObj.img });
        });
      }

      const pdfDoc = await PDFLib.PDFDocument.create();

      const processImageElement = async (imgElement) => {
        try {
          const imgData = imgElement.src;

          let image;
          if (imgData.startsWith('data:image/png')) {
            image = await pdfDoc.embedPng(imgData);
          } else if (imgData.startsWith('data:image/jpeg') || imgData.startsWith('data:image/jpg')) {
            image = await pdfDoc.embedJpg(imgData);
          } else {
            const blob = await fetch(imgData).then(r => r.blob());
            const dataUrl = await new Promise((resolve) => {
              const reader = new FileReader();
              reader.onload = () => resolve(reader.result);
              reader.readAsDataURL(blob);
            });

            if (blob.type === 'image/png') {
              image = await pdfDoc.embedPng(dataUrl);
            } else if (blob.type === 'image/jpeg') {
              image = await pdfDoc.embedJpg(dataUrl);
            } else {
              throw new Error('Unsupported image type');
            }
          }

          const { width, height } = image.scale(2);
          const page = pdfDoc.addPage([width, height]);
          page.drawImage(image, { x: 0, y: 0, width, height });
        } catch (err) {
          console.error("Failed to embed image:", err);
        }
      };

      // Process all collected image elements
      for (const fileObj of fileList) {
        if (fileObj.type === 'imageElement') {
          await processImageElement(fileObj.element);
        }
      }

      const pdfBytes = await pdfDoc.save();

      const pdfName = document.querySelector("#output").innerText.trim();

      const createFileName = () => {
        const today = new Date();
        const pad = (n) => n.toString().padStart(2, '0');
        const day = pad(today.getDate());
        const month = pad(today.getMonth() + 1);
        const year = today.getFullYear();
        const hours = pad(today.getHours());
        const minutes = pad(today.getMinutes());
        const seconds = pad(today.getSeconds());
        return `PDF ${day}-${month}-${year} ${hours}-${minutes}-${seconds}.pdf`;
      };

      const fileName = pdfName
        ? (pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`)
        : createFileName();

      const blob = new Blob([pdfBytes], { type: 'application/pdf' });

      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = fileName;
      link.click();

      // Create and download the PDF
      const blobUrl = URL.createObjectURL(blob);

      // 1. Open in a new tab
      //window.open(blobUrl, '_blank');
    });


    document.querySelector('#resizetoA4').addEventListener("click", function () {
      document.querySelectorAll("img").forEach(function (e) {
        e.style.width = "210mm";
        e.style.height = "290mm";
      })
    })

    const select = document.getElementById('imageSelector');

    document.body.addEventListener('keydown', function (event) {
      let selectedIndex = select.selectedIndex;

      if (event.key === 'PageDown') {
        event.preventDefault();
        if (selectedIndex < select.options.length - 1) {
          select.selectedIndex = selectedIndex + 1;
          // Dispatch change event
          select.dispatchEvent(new Event('change'));
        }
      } else if (event.key === 'PageUp') {
        event.preventDefault();
        if (selectedIndex > 0) {
          select.selectedIndex = selectedIndex - 1;
          // Dispatch change event
          select.dispatchEvent(new Event('change'));
        }
      }
    });

    // Optional: listen for changes on the select
    select.addEventListener('change', () => {
      console.log('Selected image:', select.value);
    });


    document.querySelector('#invertcolor').addEventListener("click", function () {
      invertcolor();
    });

    document.querySelector('#InvertContrastStreching').addEventListener("click", function () {
      invertcolor();
      applyContrastStretching();
      invertcolor();
    })

    function invertcolor() {
      const ctx = document.querySelector("canvas").getContext('2d', { willReadFrequently: true });
      // Get the image data from the canvas
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Loop through every pixel and invert the colors
      for (let i = 0; i < data.length; i += 4) {
        // Invert Red, Green, Blue channels
        data[i] = 255 - data[i];     // Red
        data[i + 1] = 255 - data[i + 1]; // Green
        data[i + 2] = 255 - data[i + 2]; // Blue
        // Alpha (data[i + 3]) remains the same
      }

      // Put the modified image data back to the canvas
      ctx.putImageData(imageData, 0, 0);
    }

    // Apply Gamma Correction
    function applyGammaCorrection() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");

      const gamma = 0.8;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.pow(data[i] / 255, gamma) * 255;         // R
        data[i + 1] = Math.pow(data[i + 1] / 255, gamma) * 255; // G
        data[i + 2] = Math.pow(data[i + 2] / 255, gamma) * 255; // B
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function applyRetinexToShadows(shadowThreshold = 80, alpha = 0.8) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const sigma = 15;

      // Calculate intensity (luminance) + offset
      const intensity = new Float32Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        intensity[idx] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2] + 1;
      }

      // Blur intensity
      const blurredIntensity = separableBoxBlur(intensity, width, height, sigma);

      // Compute Retinex intensity (log difference)
      const retinexIntensity = new Float32Array(width * height);
      let minVal = Infinity, maxVal = -Infinity;
      for (let i = 0; i < intensity.length; i++) {
        retinexIntensity[i] = Math.log(intensity[i]) - Math.log(blurredIntensity[i] + 1e-5);
        if (retinexIntensity[i] < minVal) minVal = retinexIntensity[i];
        if (retinexIntensity[i] > maxVal) maxVal = retinexIntensity[i];
      }
      const scale = 255 / (maxVal - minVal);

      for (let i = 0; i < data.length; i += 4) {
        const idx = i / 4;
        const pixelIntensity = (intensity[idx] - 1); // remove offset
        if (pixelIntensity < shadowThreshold) {
          // This is a shadow pixel — apply Retinex enhancement here

          const normRetinex = (retinexIntensity[idx] - minVal) * scale;
          const origIntensity = intensity[idx];

          const factor = normRetinex / origIntensity;

          // Scale RGB by factor but blend with original color to keep naturalness
          data[i] = clamp(alpha * data[i] * factor + (1 - alpha) * data[i]);
          data[i + 1] = clamp(alpha * data[i + 1] * factor + (1 - alpha) * data[i + 1]);
          data[i + 2] = clamp(alpha * data[i + 2] * factor + (1 - alpha) * data[i + 2]);
        }
        // else: leave pixel unchanged
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function smoothStep(edge0, edge1, x) {
      const t = Math.min(Math.max((x - edge0) / (edge1 - edge0), 0), 1);
      return t * t * (3 - 2 * t);
    }



    // Clamp value between 0 and 255
    function clamp(val) {
      return val < 0 ? 0 : val > 255 ? 255 : val;
    }

    // Separable Box Blur (fast approx Gaussian blur)
    // Blur radius ~ sigma; number of passes = 3 for better approx
    function separableBoxBlur(src, width, height, sigma) {
      // Number of box blur passes - 3 is a good approx of Gaussian
      const passes = 3;

      // Calculate box sizes for approx Gaussian based on sigma
      // Formula from: https://www.peterkovesi.com/papers/FastGaussianSmoothing.pdf
      const boxSizes = calculateBoxesForGaussian(sigma, passes);

      let temp = new Float32Array(src.length);
      let out = new Float32Array(src.length);

      src.forEach((v, i) => temp[i] = v);

      for (let i = 0; i < passes; i++) {
        boxBlurHorizontal(temp, out, width, height, Math.floor((boxSizes[i] - 1) / 2));
        boxBlurVertical(out, temp, width, height, Math.floor((boxSizes[i] - 1) / 2));
      }

      return temp; // after odd passes, result is in temp
    }

    // Calculate sizes of boxes to approximate Gaussian blur with given sigma and passes
    function calculateBoxesForGaussian(sigma, n) {
      // Ideal filter width
      const wIdeal = Math.sqrt((12 * sigma * sigma / n) + 1);
      let wl = Math.floor(wIdeal);
      if (wl % 2 === 0) wl--;
      const wu = wl + 2;

      const mIdeal = (12 * sigma * sigma - n * wl * wl - 4 * n * wl - 3 * n) / (-4 * wl - 4);
      const m = Math.round(mIdeal);

      const sizes = [];
      for (let i = 0; i < n; i++) {
        sizes.push(i < m ? wl : wu);
      }
      return sizes;
    }

    // Box blur horizontal pass
    function boxBlurHorizontal(src, dst, width, height, radius) {
      const iarr = 1 / (radius + radius + 1);
      for (let y = 0; y < height; y++) {
        let ti = y * width, li = ti, ri = ti + radius;
        let val = 0;

        for (let i = 0; i < radius; i++) val += src[ti + i];
        for (let i = 0; i <= radius; i++) val += src[ri++];

        for (let x = 0; x < width; x++) {
          dst[ti++] = val * iarr;
          val -= src[li++];
          if (ri < (y + 1) * width) val += src[ri++];
        }
      }
    }

    // Box blur vertical pass
    function boxBlurVertical(src, dst, width, height, radius) {
      const iarr = 1 / (radius + radius + 1);
      for (let x = 0; x < width; x++) {
        let ti = x, li = ti, ri = ti + radius * width;
        let val = 0;

        for (let i = 0; i < radius; i++) val += src[ti + i * width];
        for (let i = 0; i <= radius; i++) val += src[ri];
        ri += width;

        for (let y = 0; y < height; y++) {
          dst[ti] = val * iarr;
          ti += width;
          val -= src[li];
          li += width;
          if (ri < width * height) val += src[ri];
          ri += width;
        }
      }
    }


    // Box blur for luminance
    function boxBlurLuminance(src, width, height, radius) {
      const dst = new Float32Array(width * height);
      const size = radius * 2 + 1;

      // Horizontal pass
      const temp = new Float32Array(width * height);
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let count = 0;
          for (let dx = -radius; dx <= radius; dx++) {
            const nx = x + dx;
            if (nx >= 0 && nx < width) {
              sum += src[y * width + nx];
              count++;
            }
          }
          temp[y * width + x] = sum / count;
        }
      }

      // Vertical pass
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let sum = 0;
          let count = 0;
          for (let dy = -radius; dy <= radius; dy++) {
            const ny = y + dy;
            if (ny >= 0 && ny < height) {
              sum += temp[ny * width + x];
              count++;
            }
          }
          dst[y * width + x] = sum / count;
        }
      }

      return dst;
    }

    // RGB → HSV
    function rgbToHsv(r, g, b) {
      let max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h, s, v = max;

      let d = max - min;
      s = max === 0 ? 0 : d / max;

      if (max === min) {
        h = 0;
      } else {
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return { h, s, v };
    }

    // HSV → RGB
    function hsvToRgb(h, s, v) {
      let r, g, b;

      let i = Math.floor(h * 6);
      let f = h * 6 - i;
      let p = v * (1 - s);
      let q = v * (1 - f * s);
      let t = v * (1 - (1 - f) * s);

      switch (i % 6) {
        case 0: r = v; g = t; b = p; break;
        case 1: r = q; g = v; b = p; break;
        case 2: r = p; g = v; b = t; break;
        case 3: r = p; g = q; b = v; break;
        case 4: r = t; g = p; b = v; break;
        case 5: r = v; g = p; b = q; break;
      }

      return { r, g, b };
    }



    // Apply Brightness Adjustment
    function applyBrightnessAdjustment() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");

      const brightness = 30;
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(Math.max(data[i] + brightness, 0), 255);
        data[i + 1] = Math.min(Math.max(data[i + 1] + brightness, 0), 255);
        data[i + 2] = Math.min(Math.max(data[i + 2] + brightness, 0), 255);
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function globalContrastStretching(canvas = document.querySelector("canvas")) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("2D context not available.");
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Find the minimum and maximum pixel intensity (consider RGB channels only)
      let minIntensity = 255;
      let maxIntensity = 0;

      for (let i = 0; i < data.length; i += 4) {
        // Consider R, G, B channels
        minIntensity = Math.min(minIntensity, data[i], data[i + 1], data[i + 2]);
        maxIntensity = Math.max(maxIntensity, data[i], data[i + 1], data[i + 2]);
      }

      // Prevent division by zero in case min and max are equal
      const intensityRange = maxIntensity - minIntensity;
      if (intensityRange === 0) {
        console.warn("Image has uniform color; contrast stretching is not applicable.");
        return;
      }

      const scale = 255 / intensityRange;

      // Stretch contrast for each RGB pixel
      for (let i = 0; i < data.length; i += 4) {
        data[i] = Math.min(255, Math.max(0, Math.round((data[i] - minIntensity) * scale)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round((data[i + 1] - minIntensity) * scale)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round((data[i + 2] - minIntensity) * scale)));
        // Alpha channel remains unchanged (data[i + 3])
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function toneMapReinhardWithExposure(canvas = document.querySelector("canvas"), exposure = 2.0) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("2D context not available.");
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        let r = data[i] / 255;
        let g = data[i + 1] / 255;
        let b = data[i + 2] / 255;

        // Scale RGB by exposure
        r *= exposure;
        g *= exposure;
        b *= exposure;

        // Compute luminance
        const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;

        // Reinhard tone mapping
        const toneMappedL = luminance / (1.0 + luminance);
        const scale = luminance > 0 ? toneMappedL / luminance : 0;

        // Apply tone mapping
        r = r * scale;
        g = g * scale;
        b = b * scale;

        data[i] = Math.min(255, Math.max(0, Math.round(r * 255)));
        data[i + 1] = Math.min(255, Math.max(0, Math.round(g * 255)));
        data[i + 2] = Math.min(255, Math.max(0, Math.round(b * 255)));
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function applyMagicFilter(threshold = 180) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const histogram = new Array(256).fill(0);
      const luminances = [];

      // Step 1: Calculate luminance and collect foreground pixels
      for (let i = 0; i < data.length; i += 4) {
        const r = data[i], g = data[i + 1], b = data[i + 2];
        const lum = 0.299 * r + 0.587 * g + 0.114 * b;
        luminances.push(lum);

        if (lum < threshold) {
          histogram[Math.floor(lum)]++;
        }
      }

      // Step 2: Compute CDF (Cumulative Distribution Function)
      const cdf = new Array(256).fill(0);
      cdf[0] = histogram[0];
      for (let i = 1; i < 256; i++) {
        cdf[i] = cdf[i - 1] + histogram[i];
      }

      const cdfMin = cdf.find(v => v > 0);
      const totalPixels = cdf[255];
      const lookup = cdf.map(v =>
        totalPixels > cdfMin ? Math.round(((v - cdfMin) / (totalPixels - cdfMin)) * 255) : 0
      );

      // Step 3: Apply filter
      for (let i = 0; i < data.length; i += 4) {
        const lum = luminances[i / 4];

        if (lum < threshold) {
          // Foreground: apply histogram equalization
          data[i] = lookup[data[i]];
          data[i + 1] = lookup[data[i + 1]];
          data[i + 2] = lookup[data[i + 2]];
        } else {
          // Background: make it white
          data[i] = 255;
          data[i + 1] = 255;
          data[i + 2] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function applyBiHistogramEqualizationWithEdgePreservation() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      // Get original image data
      const originalImageData = ctx.getImageData(0, 0, width, height);
      const originalData = originalImageData.data;

      // Clone original to work on equalized image
      const equalizedImageData = ctx.getImageData(0, 0, width, height);
      const data = equalizedImageData.data;

      // ===== Step 1: Bi-Histogram Equalization on equalizedImageData =====
      // (Same as before, HSL based)
      // Build histogram and lightness array
      const histogram = new Array(256).fill(0);
      const lightnessValues = [];

      for (let i = 0; i < data.length; i += 4) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const [h, s, l] = rgbToHsl(r, g, b);
        const lum = Math.round(l * 255);

        lightnessValues.push({ h, s, l, index: i });
        histogram[lum]++;
      }

      let sum = 0, total = lightnessValues.length;
      for (let i = 0; i < 256; i++) sum += i * histogram[i];
      const mean = Math.floor(sum / total);

      const cdfLower = new Array(256).fill(0);
      const cdfUpper = new Array(256).fill(0);
      let cdfL = 0, cdfU = 0;

      for (let i = 0; i <= mean; i++) {
        cdfL += histogram[i];
        cdfLower[i] = cdfL;
      }
      for (let i = mean + 1; i < 256; i++) {
        cdfU += histogram[i];
        cdfUpper[i] = cdfU;
      }

      const totalL = cdfLower[mean];
      const totalU = cdfUpper[255];
      const baseUpper = cdfUpper[mean];

      const map = new Array(256);
      for (let i = 0; i <= mean; i++) {
        map[i] = (cdfLower[i] / totalL) * mean;
      }
      for (let i = mean + 1; i < 256; i++) {
        map[i] = ((cdfUpper[i] - baseUpper) / (totalU - baseUpper)) * (255 - mean - 1) + mean + 1;
      }

      for (const { h, s, l, index } of lightnessValues) {
        const oldLum = Math.round(l * 255);
        const newLum = map[oldLum] / 255;
        const [r, g, b] = hslToRgb(h, s, newLum);

        data[index] = Math.round(r * 255);
        data[index + 1] = Math.round(g * 255);
        data[index + 2] = Math.round(b * 255);
      }

      // ===== Step 2: Edge-preserving sharpening =====
      // Blur original image (small kernel)
      const blurredOriginal = boxBlur(originalImageData, width, height);

      // Extract edges by subtracting blurred original from original
      const edges = new Uint8ClampedArray(originalData.length);
      for (let i = 0; i < originalData.length; i += 4) {
        edges[i] = clamp(originalData[i] - blurredOriginal.data[i]);
        edges[i + 1] = clamp(originalData[i + 1] - blurredOriginal.data[i + 1]);
        edges[i + 2] = clamp(originalData[i + 2] - blurredOriginal.data[i + 2]);
        edges[i + 3] = 255;
      }

      // Add edges back to equalized image with an amount factor
      const amount = 1.0; // tweak between 0 (no sharpening) to ~2 (strong)
      for (let i = 0; i < data.length; i += 4) {
        data[i] = clamp(data[i] + amount * edges[i]);
        data[i + 1] = clamp(data[i + 1] + amount * edges[i + 1]);
        data[i + 2] = clamp(data[i + 2] + amount * edges[i + 2]);
        // alpha unchanged
      }

      ctx.putImageData(equalizedImageData, 0, 0);
    }

    // Helpers (same as before) ...
    function boxBlur(imageData, width, height) {
      const data = imageData.data;
      const result = new Uint8ClampedArray(data.length);
      const kernelSize = 3;
      const half = Math.floor(kernelSize / 2);

      const getIndex = (x, y) => 4 * (y * width + x);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let r = 0, g = 0, b = 0, count = 0;

          for (let ky = -half; ky <= half; ky++) {
            for (let kx = -half; kx <= half; kx++) {
              const nx = x + kx;
              const ny = y + ky;
              if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
                const idx = getIndex(nx, ny);
                r += data[idx];
                g += data[idx + 1];
                b += data[idx + 2];
                count++;
              }
            }
          }

          const idx = getIndex(x, y);
          result[idx] = r / count;
          result[idx + 1] = g / count;
          result[idx + 2] = b / count;
          result[idx + 3] = data[idx + 3]; // alpha
        }
      }

      return new ImageData(result, width, height);
    }

    function clamp(value) {
      return Math.min(255, Math.max(0, value));
    }

    function rgbToHsl(r, g, b) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s = 0;
      const l = (max + min) / 2;

      if (max !== min) {
        const d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch (max) {
          case r: h = (g - b) / d + (g < b ? 6 : 0); break;
          case g: h = (b - r) / d + 2; break;
          case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
      }

      return [h, s, l];
    }

    function hslToRgb(h, s, l) {
      if (s === 0) return [l, l, l];

      const hue2rgb = (p, q, t) => {
        if (t < 0) t += 1;
        if (t > 1) t -= 1;
        if (t < 1 / 6) return p + (q - p) * 6 * t;
        if (t < 1 / 2) return q;
        if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
        return p;
      };

      const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
      const p = 2 * l - q;

      const r = hue2rgb(p, q, h + 1 / 3);
      const g = hue2rgb(p, q, h);
      const b = hue2rgb(p, q, h - 1 / 3);

      return [r, g, b];
    }



    function applyGaussianBlur(kernelSize = 5, sigma = 1.0) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const width = canvas.width, height = canvas.height;
      const data = imageData.data;
      const output = new Uint8ClampedArray(data);

      // Generate Gaussian kernel
      function gaussian(x, y) {
        return (1 / (2 * Math.PI * sigma * sigma)) *
          Math.exp(-(x * x + y * y) / (2 * sigma * sigma));
      }

      const half = Math.floor(kernelSize / 2);
      const kernel = [];
      let sum = 0;

      for (let y = -half; y <= half; y++) {
        for (let x = -half; x <= half; x++) {
          const g = gaussian(x, y);
          kernel.push(g);
          sum += g;
        }
      }

      // Normalize the kernel
      for (let i = 0; i < kernel.length; i++) {
        kernel[i] /= sum;
      }

      function getIndex(x, y) {
        return (y * width + x) * 4;
      }

      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          let r = 0, g = 0, b = 0;
          let k = 0;
          for (let ky = -half; ky <= half; ky++) {
            for (let kx = -half; kx <= half; kx++) {
              const i = getIndex(x + kx, y + ky);
              r += data[i] * kernel[k];
              g += data[i + 1] * kernel[k];
              b += data[i + 2] * kernel[k];
              k++;
            }
          }

          const idx = getIndex(x, y);
          output[idx] = r;
          output[idx + 1] = g;
          output[idx + 2] = b;
        }
      }

      imageData.data.set(output);
      ctx.putImageData(imageData, 0, 0);
    }

    function applyGuidedFilter(radius = 8, epsilon = 0.02) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const width = canvas.width, height = canvas.height;
      const data = imageData.data;
      const output = new Uint8ClampedArray(data.length);

      const N = (2 * radius + 1) ** 2;

      // Box filter with integral image for fast local sum calculation
      function boxFilter(img, width, height, r) {
        const result = new Float32Array(width * height);
        const integral = new Float32Array((width + 1) * (height + 1));

        // Compute integral image
        for (let y = 0; y < height; y++) {
          let sum = 0;
          for (let x = 0; x < width; x++) {
            sum += img[y * width + x];
            integral[(y + 1) * (width + 1) + (x + 1)] = integral[y * (width + 1) + (x + 1)] + sum;
          }
        }

        // Compute box filter by integral image sums
        for (let y = 0; y < height; y++) {
          const y1 = Math.max(0, y - r);
          const y2 = Math.min(height - 1, y + r);
          for (let x = 0; x < width; x++) {
            const x1 = Math.max(0, x - r);
            const x2 = Math.min(width - 1, x + r);

            const A = integral[y1 * (width + 1) + x1];
            const B = integral[y1 * (width + 1) + (x2 + 1)];
            const C = integral[(y2 + 1) * (width + 1) + x1];
            const D = integral[(y2 + 1) * (width + 1) + (x2 + 1)];

            result[y * width + x] = D - B - C + A;
          }
        }
        return result;
      }

      // Split channels R, G, B into separate float arrays normalized [0..1]
      const I_r = new Float32Array(width * height);
      const I_g = new Float32Array(width * height);
      const I_b = new Float32Array(width * height);

      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        I_r[i] = data[idx] / 255;
        I_g[i] = data[idx + 1] / 255;
        I_b[i] = data[idx + 2] / 255;
      }

      // Guided filter helper for one channel
      function guidedFilterChannel(I) {
        // mean_I
        const mean_I = boxFilter(I, width, height, radius).map(v => v / N);
        // corr_I = mean of I*I
        const II = I.map(v => v * v);
        const corr_I = boxFilter(II, width, height, radius).map(v => v / N);

        // variance of I in window
        const var_I = new Float32Array(width * height);
        for (let i = 0; i < var_I.length; i++) {
          var_I[i] = corr_I[i] - mean_I[i] * mean_I[i];
        }

        // Since we're filtering the input image itself (p = I), covariance cov_Ip = var_I
        // a = cov_Ip / (var_I + epsilon) = var_I / (var_I + epsilon)
        const a = new Float32Array(width * height);
        for (let i = 0; i < a.length; i++) {
          a[i] = var_I[i] / (var_I[i] + epsilon);
        }

        // b = mean_p - a * mean_I; p = I, so mean_p = mean_I
        const b = new Float32Array(width * height);
        for (let i = 0; i < b.length; i++) {
          b[i] = mean_I[i] - a[i] * mean_I[i];
        }

        // mean_a and mean_b
        const mean_a = boxFilter(a, width, height, radius).map(v => v / N);
        const mean_b = boxFilter(b, width, height, radius).map(v => v / N);

        // q = mean_a * I + mean_b
        const q = new Float32Array(width * height);
        for (let i = 0; i < q.length; i++) {
          q[i] = mean_a[i] * I[i] + mean_b[i];
        }

        return q;
      }

      // Apply guided filter to each color channel
      const out_r = guidedFilterChannel(I_r);
      const out_g = guidedFilterChannel(I_g);
      const out_b = guidedFilterChannel(I_b);

      // Write back to output Uint8ClampedArray
      for (let i = 0; i < width * height; i++) {
        const idx = i * 4;
        output[idx] = Math.min(255, Math.max(0, Math.round(out_r[i] * 255)));
        output[idx + 1] = Math.min(255, Math.max(0, Math.round(out_g[i] * 255)));
        output[idx + 2] = Math.min(255, Math.max(0, Math.round(out_b[i] * 255)));
        output[idx + 3] = data[idx + 3]; // preserve alpha channel
      }

      // Update canvas with filtered image
      imageData.data.set(output);
      ctx.putImageData(imageData, 0, 0);
    }


    function applyMedianBlur(kernelSize = 3) {
      if (kernelSize % 2 === 0 || kernelSize < 1) {
        console.error("Kernel size must be an odd number >= 1.");
        return;
      }

      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const width = canvas.width;
      const height = canvas.height;
      const src = imageData.data;
      const dst = new Uint8ClampedArray(src.length);

      const half = Math.floor(kernelSize / 2);
      const windowSize = kernelSize * kernelSize;

      const rVals = new Uint8Array(windowSize);
      const gVals = new Uint8Array(windowSize);
      const bVals = new Uint8Array(windowSize);
      const aVals = new Uint8Array(windowSize);

      const getIndex = (x, y) => (y * width + x) * 4;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          let count = 0;

          for (let ky = -half; ky <= half; ky++) {
            const ny = Math.min(height - 1, Math.max(0, y + ky));
            for (let kx = -half; kx <= half; kx++) {
              const nx = Math.min(width - 1, Math.max(0, x + kx));
              const idx = getIndex(nx, ny);

              rVals[count] = src[idx];
              gVals[count] = src[idx + 1];
              bVals[count] = src[idx + 2];
              aVals[count] = src[idx + 3];
              count++;
            }
          }

          const mid = Math.floor(count / 2);
          const median = arr => {
            const copy = Array.from(arr.subarray(0, count));
            copy.sort((a, b) => a - b);
            return copy[mid];
          };

          const dstIdx = getIndex(x, y);
          dst[dstIdx] = median(rVals);
          dst[dstIdx + 1] = median(gVals);
          dst[dstIdx + 2] = median(bVals);
          dst[dstIdx + 3] = median(aVals);
        }
      }

      imageData.data.set(dst);
      ctx.putImageData(imageData, 0, 0);
    }


    function downscaleImage(canvas, maxWidth, maxHeight) {
      const originalWidth = canvas.width;
      const originalHeight = canvas.height;

      // Don't upscale
      if (originalWidth <= maxWidth && originalHeight <= maxHeight) return;

      let scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);

      // Use an offscreen canvas to preserve the original
      let offCanvas = document.createElement("canvas");
      let offCtx = offCanvas.getContext("2d");

      offCanvas.width = originalWidth;
      offCanvas.height = originalHeight;
      offCtx.drawImage(canvas, 0, 0);

      let currentWidth = originalWidth;
      let currentHeight = originalHeight;

      // Progressive downscale
      while (currentWidth * scale > maxWidth * 1.5 || currentHeight * scale > maxHeight * 1.5) {
        currentWidth = Math.floor(currentWidth * 0.5);
        currentHeight = Math.floor(currentHeight * 0.5);

        const tempCanvas = document.createElement("canvas");
        tempCanvas.width = currentWidth;
        tempCanvas.height = currentHeight;
        const tempCtx = tempCanvas.getContext("2d");

        tempCtx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, 0, 0, currentWidth, currentHeight);

        offCanvas = tempCanvas;
        offCtx = tempCtx;
      }

      // Final downscale to target size
      const finalWidth = Math.floor(originalWidth * scale);
      const finalHeight = Math.floor(originalHeight * scale);

      canvas.width = finalWidth;
      canvas.height = finalHeight;

      const finalCtx = canvas.getContext("2d");
      finalCtx.drawImage(offCanvas, 0, 0, offCanvas.width, offCanvas.height, 0, 0, finalWidth, finalHeight);

      // Replace image with warped version
      const newImg = new Image();
      newImg.src = canvas.toDataURL();
      newImg.onload = () => {
        images[currentImageIndex] = new ImageObject(newImg);
        loadCurrentImage();
      };
    }

    async function downscaleAllImages(maxWidth, maxHeight) {
    for (let i = 0; i < images.length; i++) {
        const img = images[i].img || images[i]; // supports ImageObject or Image

        const canvas = document.createElement("canvas");
        canvas.width = img.naturalWidth || img.width;
        canvas.height = img.naturalHeight || img.height;

        const ctx = canvas.getContext("2d");
        ctx.drawImage(img, 0, 0);

        downscaleImage(canvas, maxWidth, maxHeight);

        await new Promise((resolve) => {
            const newImg = new Image();

            newImg.onload = () => {
                if (images[i] instanceof ImageObject) {
                    images[i] = new ImageObject(newImg);
                } else {
                    images[i] = newImg;
                }
                resolve();
            };

            newImg.src = canvas.toDataURL("image/png");
        });
    }

    loadCurrentImage();
}

    function upscaleAndSharpen(canvas, maxWidth, maxHeight) {
      const originalWidth = canvas.width;
      const originalHeight = canvas.height;

      // Calculate scale to maintain aspect ratio
      const scale = Math.min(maxWidth / originalWidth, maxHeight / originalHeight);

      // Calculate new dimensions
      const targetWidth = Math.floor(originalWidth * scale);
      const targetHeight = Math.floor(originalHeight * scale);

      // Create offscreen canvas to perform upscale
      const upscaleCanvas = document.createElement("canvas");
      upscaleCanvas.width = targetWidth;
      upscaleCanvas.height = targetHeight;
      const upscaleCtx = upscaleCanvas.getContext("2d");

      // Enable high-quality image smoothing
      upscaleCtx.imageSmoothingEnabled = true;
      upscaleCtx.imageSmoothingQuality = "high";

      // Draw the original image scaled to target size
      upscaleCtx.drawImage(canvas, 0, 0, targetWidth, targetHeight);

      // Get image data for sharpening
      const imageData = upscaleCtx.getImageData(0, 0, targetWidth, targetHeight);
      const data = imageData.data;

      // Sharpen kernel matrix (3x3)
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];

      // Copy original image data to avoid overwriting during convolution
      const copy = new Uint8ClampedArray(data);

      const width = targetWidth;
      const height = targetHeight;
      const kernelSize = 3;
      const half = Math.floor(kernelSize / 2);

      // Apply sharpening filter
      for (let y = half; y < height - half; y++) {
        for (let x = half; x < width - half; x++) {
          for (let c = 0; c < 3; c++) { // Loop over R, G, B channels
            let i = (y * width + x) * 4 + c;
            let sum = 0;

            for (let ky = -half; ky <= half; ky++) {
              for (let kx = -half; kx <= half; kx++) {
                const ii = ((y + ky) * width + (x + kx)) * 4 + c;
                const weight = kernel[(ky + half) * kernelSize + (kx + half)];
                sum += copy[ii] * weight;
              }
            }

            // Clamp the result between 0 and 255
            data[i] = Math.min(255, Math.max(0, sum));
          }
        }
      }

      // Update canvas with sharpened image data
      upscaleCtx.putImageData(imageData, 0, 0);

      // Resize original canvas and draw the processed image back
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      ctx.drawImage(upscaleCanvas, 0, 0);

      // Update any image references if you track them
      const newImg = new Image();
      newImg.src = canvas.toDataURL();
      newImg.onload = () => {
        images[currentImageIndex] = new ImageObject(newImg);
        loadCurrentImage();
      };
    }


    function enhanceCanvasImageColorAndSharpen() {
      const canvas = document.querySelector("canvas");
      if (!canvas) {
        console.warn("No canvas found in the document.");
        return;
      }

      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // 1. Contrast Stretching per channel (R, G, B)
      for (let channel = 0; channel < 3; channel++) {
        let min = 255, max = 0;
        for (let i = channel; i < data.length; i += 4) {
          const val = data[i];
          if (val < min) min = val;
          if (val > max) max = val;
        }

        const scale = 255 / (max - min);
        for (let i = channel; i < data.length; i += 4) {
          data[i] = Math.min(255, Math.max(0, (data[i] - min) * scale));
        }
      }

      // 2. Sharpen using convolution kernel
      const kernel = [
        0, -1, 0,
        -1, 5, -1,
        0, -1, 0
      ];

      const width = canvas.width;
      const height = canvas.height;
      const output = new Uint8ClampedArray(data.length);

      const getIndex = (x, y) => (y * width + x) * 4;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) { // R, G, B
            let sum = 0;
            let k = 0;

            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const px = x + kx;
                const py = y + ky;
                const idx = getIndex(px, py);
                sum += data[idx + c] * kernel[k];
                k++;
              }
            }

            const i = getIndex(x, y);
            output[i + c] = Math.min(255, Math.max(0, sum));
          }

          // Copy alpha channel
          const i = getIndex(x, y);
          output[i + 3] = data[i + 3];
        }
      }

      // 3. Put enhanced data back to canvas
      for (let i = 0; i < data.length; i++) {
        data[i] = output[i];
      }

      ctx.putImageData(imageData, 0, 0);
    }

    let selectedPagesToRemove = {}; // Map of file name to array of page indices to skip

    document.getElementById('mergePdfBtn').addEventListener('click', async () => {
      const pdfDoc = await PDFLib.PDFDocument.create();

      const processPdfFile = async (file) => {
        const pdfBytes = await file.arrayBuffer();
        const existingPdfDoc = await PDFLib.PDFDocument.load(pdfBytes);

        const totalPages = existingPdfDoc.getPageCount();
        const fileName = file.name;
        const pagesToSkip = selectedPagesToRemove[fileName] || [];

        const pageIndices = [...Array(totalPages).keys()].filter(index => !pagesToSkip.includes(index));

        const copiedPages = await pdfDoc.copyPages(existingPdfDoc, pageIndices);
        copiedPages.forEach(page => pdfDoc.addPage(page));
      };


      // Process all the selected files in the order they appear
      for (const fileObj of fileListPdf) {
        const file = fileObj.file;
        if (file.type === 'application/pdf') {
          await processPdfFile(file);
        }
      }

      // Serialize the PDF to bytes
      const pdfBytes = await pdfDoc.save();

      // Get the input value
      let pdfName = document.querySelector("#filename").value.trim();

      if (!pdfName) {
        // If the input is empty, use the current date and time as filename
        const now = new Date();
        const formattedDate = now.toISOString().replace(/[:.]/g, '-'); // Remove characters not safe for filenames
        pdfName = `PDF_${formattedDate}`;
      }

      // Ensure the file name ends with ".pdf"
      const fileName = pdfName.endsWith('.pdf') ? pdfName : `${pdfName}.pdf`;

      // Create and download the PDF
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const blobUrl = URL.createObjectURL(blob);

      // 1. Open in a new tab
      window.open(blobUrl, '_blank');

      // 2. Trigger a download (optional)
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = fileName;
      link.click();

      // 3. Clean up
      setTimeout(() => URL.revokeObjectURL(blobUrl), 5000);

    });

    document.getElementById('downloadFirstPages').addEventListener('click', async () => {
      const newPdfDoc = await PDFLib.PDFDocument.create();

      const fileList = fileListPdf.filter(f => f.file.type === 'application/pdf');

      if (fileList.length === 0) {
        alert('No PDFs found in the uploaded files.');
        return;
      }

      for (const { file } of fileList) {
        const bytes = await file.arrayBuffer();
        const originalPdf = await PDFLib.PDFDocument.load(bytes);
        const [firstPage] = await newPdfDoc.copyPages(originalPdf, [0]);
        newPdfDoc.addPage(firstPage);
      }

      const newPdfBytes = await newPdfDoc.save();

      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'first_pages_only.pdf';
      link.click();

      generatefidaPDF();
    });
    
    document.getElementById('BookletPDF').addEventListener('click', async () => {
      const newPdfDoc = await PDFLib.PDFDocument.create();

      const fileList = fileListPdf.filter(f => f.file.type === 'application/pdf');

      if (fileList.length === 0) {
        alert('No PDFs found in the uploaded files.');
        return;
      }

      for (const { file } of fileList) {
        const bytes = await file.arrayBuffer();
  const originalPdf = await PDFLib.PDFDocument.load(bytes);

  const pageIndices = originalPdf.getPageIndices();
  const copiedPages = await newPdfDoc.copyPages(originalPdf, pageIndices);
///*
  // ---- Swap odd and even pages ----
  for (let i = 0; i < copiedPages.length - 1; i += 2) {
    // Swap page i (even index) with page i+1 (odd index)
    const temp = copiedPages[i];
    copiedPages[i] = copiedPages[i + 1];
    copiedPages[i + 1] = temp;
  }
    //*/

  // Add copied pages
  copiedPages.forEach(page => newPdfDoc.addPage(page));

  // ---- Ensure THIS PDF is divisible by 4 ----
  const pageCount = pageIndices.length;
  const remainder = pageCount % 4;
  console.log(remainder);

  if (remainder !== 0) {    

    // Match size of last page of this PDF
    const lastPage = copiedPages[copiedPages.length - 1];
    const { width, height } = lastPage.getSize();

    for (let i = 0; i < 4-remainder; i++) {
      newPdfDoc.addPage([width, height]); // blank page
    }
  }

      }

      const newPdfBytes = await newPdfDoc.save();

      const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'Booklet.pdf';
      link.click();
    });

    document.getElementById('trueBookletPDF').addEventListener('click', async () => {
  const newPdfDoc = await PDFLib.PDFDocument.create();
  const fileList = fileListPdf.filter(f => f.file.type === 'application/pdf');

  if (fileList.length === 0) {
    alert('No PDFs found in the uploaded files.');
    return;
  }

  for (const { file } of fileList) {
    const bytes = await file.arrayBuffer();
    const originalPdf = await PDFLib.PDFDocument.load(bytes);

    const pageIndices = originalPdf.getPageIndices();
    let copiedPages = await newPdfDoc.copyPages(originalPdf, pageIndices);

    // Ensure total pages divisible by 4
    const remainder = copiedPages.length % 4;
    if (remainder !== 0) {
      const lastPage = copiedPages[copiedPages.length - 1];
      const { width, height } = lastPage.getSize();
      for (let i = 0; i < 4 - remainder; i++) {
        copiedPages.push(newPdfDoc.addPage([width, height])); // blank page
      }
    }

    // Booklet reordering algorithm
    const totalPages = copiedPages.length;
    const bookletPages = [];
    let left = 0;
    let right = totalPages - 1;

    while (left < right) {
      // One sheet: front side
      bookletPages.push(copiedPages[right]); // last page
      bookletPages.push(copiedPages[left]);  // first page

      // One sheet: back side
      left++;
      right--;
      bookletPages.push(copiedPages[left]);  // second page
      bookletPages.push(copiedPages[right]); // second-to-last page
      left++;
      right--;
    }

    // Add reordered pages to new PDF
    bookletPages.forEach(page => newPdfDoc.addPage(page));
  }

  const newPdfBytes = await newPdfDoc.save();
  const blob = new Blob([newPdfBytes], { type: 'application/pdf' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Booklet.pdf';
  link.click();
});

    document.getElementById('cropPdf').addEventListener('click', async function () {
      const pdfFiles = fileListPdf.filter(f => f.file.type === 'application/pdf');

      if (pdfFiles.length === 0) {
        alert('No PDFs found in the uploaded files.');
        return;
      }

      const reader = new FileReader();
      const croppedPdfDoc = await PDFLib.PDFDocument.create();

      // Convert inches to points (1 inch = 72 points)
      const topCrop = 3.5 * 72;
      const bottomCrop = 2.5 * 72;

      for (const { file } of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
          const { width, height } = page.getSize();
          page.setCropBox(0, topCrop, width, height - topCrop - bottomCrop);
        });

        //const copiedPages = await croppedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());For Allpages
        const copiedPages = await croppedPdfDoc.copyPages(pdfDoc, [0]);//For First Page Only
        copiedPages.forEach(page => croppedPdfDoc.addPage(page));
      }

      const croppedPdfBytes = await croppedPdfDoc.save();

      const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'cropped.pdf';
      link.click();
    });

    document.getElementById('twopagecrop').addEventListener('click', async function () {
      const pdfFiles = fileListPdf.filter(f => f.file.type === 'application/pdf');

      if (pdfFiles.length === 0) {
        alert('No PDFs found in the uploaded files.');
        return;
      }

      const croppedPdfDoc = await PDFLib.PDFDocument.create();

      // Convert inches to points (1 inch = 72 points)
      const topCrop = 0 * 72;
      const bottomCrop = 4 * 72;
      const leftCrop = 3 * 72;
      const rightCrop = 1.7 * 72;

      for (const { file } of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdfDoc = await PDFLib.PDFDocument.load(arrayBuffer);
        const pages = pdfDoc.getPages();

        pages.forEach(page => {
          const { width, height } = page.getSize();

          const cropX = leftCrop;
          const cropY = bottomCrop;
          const cropWidth = width - leftCrop - rightCrop;
          const cropHeight = height - bottomCrop - topCrop;

          // ✅ Apply the crop box correctly
          page.setCropBox(cropX, cropY, cropWidth, cropHeight);

          // Optional: force trim box and media box too, to match
          page.setMediaBox(cropX, cropY, cropWidth, cropHeight);
          page.setTrimBox(cropX, cropY, cropWidth, cropHeight);
        });

        const copiedPages = await croppedPdfDoc.copyPages(pdfDoc, pdfDoc.getPageIndices());
        copiedPages.forEach(page => croppedPdfDoc.addPage(page));
      }

      const croppedPdfBytes = await croppedPdfDoc.save();

      const blob = new Blob([croppedPdfBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'cropped.pdf';
      link.click();
    });

    function enhancePhoto(canvas, contrastFactor = 1.1, sharpenStrength = 1.0) {
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Step 1: Contrast Boost (linear)
      for (let i = 0; i < data.length; i += 4) {
        for (let j = 0; j < 3; j++) { // R, G, B
          let val = data[i + j];
          val = (val - 128) * contrastFactor + 128;
          data[i + j] = Math.max(0, Math.min(255, val));
        }
      }

      // Step 2: Clone image for blur (for unsharp mask)
      const blurredData = new Uint8ClampedArray(data);
      const blurRadius = 1;
      const kernel = [1, 2, 1, 2, 4, 2, 1, 2, 1];
      const kernelSum = 16;

      function blurPixel(x, y, c) {
        const get = (dx, dy) => {
          const nx = Math.min(width - 1, Math.max(0, x + dx));
          const ny = Math.min(height - 1, Math.max(0, y + dy));
          return data[(ny * width + nx) * 4 + c];
        };

        const weightedSum =
          get(-1, -1) * 1 + get(0, -1) * 2 + get(1, -1) * 1 +
          get(-1, 0) * 2 + get(0, 0) * 4 + get(1, 0) * 2 +
          get(-1, 1) * 1 + get(0, 1) * 2 + get(1, 1) * 1;

        return weightedSum / kernelSum;
      }

      // Step 3: Unsharp Mask
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          for (let c = 0; c < 3; c++) { // R, G, B
            const blurred = blurPixel(x, y, c);
            const orig = data[i + c];
            const sharpened = orig + sharpenStrength * (orig - blurred);
            blurredData[i + c] = Math.max(0, Math.min(255, sharpened));
          }
          blurredData[i + 3] = 255; // Alpha
        }
      }

      // Step 4: Apply final image
      const finalImage = new ImageData(blurredData, width, height);
      ctx.putImageData(finalImage, 0, 0);
    }


    async function generatefidaPDF() {
      const { jsPDF } = window.jspdf;
      const today = new Date();
      const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun",
        "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
      const formattedDate = `${String(today.getDate()).padStart(2, '0')}-${months[today.getMonth()]}-${today.getFullYear()}`;

      const doc = new jsPDF({ orientation: "landscape", format: "a4" });

      // Add date
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(25);
      doc.text(`Date: ${formattedDate}`, 35, 30);

      // Bold and center within right half
      doc.setFont("Helvetica", "bold");
      const text = "Fida Hussain";
      doc.text(text, 65, 70);

      // Show number of pages
      doc.setFont("Helvetica", "normal");
      //doc.text("No of printed pages: " + pages, 20, 90);
      //doc.text("No of printed pages: " + document.querySelectorAll('.pdf-page-count').length, 35, 90);
      doc.text("No of printed pages: " + fileListPdf.length, 35, 90);

      // Signature line
      doc.text("Signature: ____________", 35, 150);

      // Add date
      doc.setFont("Helvetica", "normal");
      doc.setFontSize(25);
      doc.text(`Date:        -${months[today.getMonth()]}-${today.getFullYear()}`, 170, 30);

      // Bold and center within right half
      doc.setFont("Helvetica", "bold");
      doc.text("Fida Hussain", 220, 70);

      // Show number of pages
      doc.setFont("Helvetica", "normal");
      //doc.text("No of printed pages: " + pages, 20, 90);
      doc.text("No of printed pages: ", 170, 90);

      // Signature line
      doc.text("Signature: ____________", 170, 150);

      doc.save("fida_hussain " + formattedDate + ".pdf");
    }

    function matchHistogram(referenceRegion, shadowRegion) {
      const refHist = new Array(256).fill(0);
      const shdHist = new Array(256).fill(0);

      for (const val of referenceRegion) refHist[val]++;
      for (const val of shadowRegion) shdHist[val]++;

      const refCdf = new Array(256).fill(0);
      const shdCdf = new Array(256).fill(0);
      refCdf[0] = refHist[0];
      shdCdf[0] = shdHist[0];

      for (let i = 1; i < 256; i++) {
        refCdf[i] = refCdf[i - 1] + refHist[i];
        shdCdf[i] = shdCdf[i - 1] + shdHist[i];
      }

      const mapping = new Uint8Array(256);
      let j = 0;
      for (let i = 0; i < 256; i++) {
        while (j < 255 && shdCdf[i] > refCdf[j]) j++;
        mapping[i] = j;
      }

      return mapping;
    }

    function applyHistogramCorrection(mapping) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        data[i] = mapping[data[i]];
        data[i + 1] = mapping[data[i + 1]];
        data[i + 2] = mapping[data[i + 2]];
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function segmentImageByLuminance(threshold = 100) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        const val = lum < threshold ? 0 : 255;
        data[i] = data[i + 1] = data[i + 2] = val;
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function applySobelEdgeDetection() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      const grayscale = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayscale[i / 4] = lum;
      }

      const sobelData = new Uint8ClampedArray(data.length);
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sumX = 0, sumY = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = x + kx;
              const py = y + ky;
              const val = grayscale[py * width + px];
              const idx = (ky + 1) * 3 + (kx + 1);
              sumX += val * gx[idx];
              sumY += val * gy[idx];
            }
          }
          const mag = Math.sqrt(sumX ** 2 + sumY ** 2);
          const i = (y * width + x) * 4;
          sobelData[i] = sobelData[i + 1] = sobelData[i + 2] = mag;
          sobelData[i + 3] = 255;
        }
      }

      const newImageData = new ImageData(sobelData, width, height);
      ctx.putImageData(newImageData, 0, 0);
    }

    function applySobelMask() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const width = canvas.width;
      const height = canvas.height;

      // Step 1: Convert to Grayscale
      const grayscale = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        const lum = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
        grayscale[i / 4] = lum;
      }

      // Step 2: Sobel Kernels
      const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
      const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

      // Output image (original image masked by edge map)
      const maskedData = new Uint8ClampedArray(data.length);

      // Step 3: Apply Sobel Filter and Build Mask
      const threshold = 100; // Adjustable: lower = more edges

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sumX = 0, sumY = 0;

          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = x + kx;
              const py = y + ky;
              const val = grayscale[py * width + px];
              const idx = (ky + 1) * 3 + (kx + 1);
              sumX += val * gx[idx];
              sumY += val * gy[idx];
            }
          }

          const mag = Math.sqrt(sumX ** 2 + sumY ** 2);
          const i = (y * width + x) * 4;

          if (mag > threshold) {
            // Keep original pixel where edge is strong
            maskedData[i] = data[i];
            maskedData[i + 1] = data[i + 1];
            maskedData[i + 2] = data[i + 2];
            maskedData[i + 3] = 255;
          } else {
            // Make pixel transparent (or black)
            maskedData[i] = 0;
            maskedData[i + 1] = 0;
            maskedData[i + 2] = 0;
            maskedData[i + 3] = 0; // transparent
          }
        }
      }

      const newImageData = new ImageData(maskedData, width, height);
      ctx.putImageData(newImageData, 0, 0);
    }


    function applyCorrection(shadowMask, imageData, mappings) {
      const data = imageData.data;

      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        if (shadowMask[j]) {
          data[i] = mappings.rMap[data[i]];
          data[i + 1] = mappings.gMap[data[i + 1]];
          data[i + 2] = mappings.bMap[data[i + 2]];
        }
      }

      return imageData;
    }

    function matchHistogram(source, reference) {
      const histSize = 256;
      const srcHist = new Array(histSize).fill(0);
      const refHist = new Array(histSize).fill(0);

      for (let val of source) srcHist[val]++;
      for (let val of reference) refHist[val]++;

      // Normalize histograms
      const srcCdf = cumulativeDistribution(srcHist, source.length);
      const refCdf = cumulativeDistribution(refHist, reference.length);

      // Create lookup table
      const mapping = new Uint8ClampedArray(256);
      let refIdx = 0;
      for (let srcIdx = 0; srcIdx < 256; srcIdx++) {
        while (refIdx < 255 && refCdf[refIdx] < srcCdf[srcIdx]) {
          refIdx++;
        }
        mapping[srcIdx] = refIdx;
      }

      return mapping;
    }

    function cumulativeDistribution(hist, total) {
      let cdf = [];
      let sum = 0;
      for (let i = 0; i < hist.length; i++) {
        sum += hist[i];
        cdf[i] = sum / total;
      }
      return cdf;
    }

    function computeHistogramMapping(shadowMask, imageData) {
      const data = imageData.data;
      const shadowPixels = [[], [], []]; // R, G, B
      const nonShadowPixels = [[], [], []];

      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const r = data[i], g = data[i + 1], b = data[i + 2];

        if (shadowMask[j]) {
          shadowPixels[0].push(r);
          shadowPixels[1].push(g);
          shadowPixels[2].push(b);
        } else {
          nonShadowPixels[0].push(r);
          nonShadowPixels[1].push(g);
          nonShadowPixels[2].push(b);
        }
      }

      const mappings = [0, 1, 2].map(channel =>
        matchHistogram(shadowPixels[channel], nonShadowPixels[channel])
      );

      return {
        rMap: mappings[0],
        gMap: mappings[1],
        bMap: mappings[2],
      };
    }

    function detectShadowMask(imageData, threshold = 60) {
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      const mask = new Uint8ClampedArray(width * height); // 0 = non-shadow, 1 = shadow

      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        // Convert to grayscale
        const r = data[i];
        const g = data[i + 1];
        const b = data[i + 2];
        const gray = 0.299 * r + 0.587 * g + 0.114 * b;

        // Shadow if below threshold
        mask[j] = gray < threshold ? 1 : 0;
      }

      return mask;
    }

    function detectShadowMaskHSV(imageData, valueDrop = 0.4, satDrop = 0.3) {
      const data = imageData.data;
      const width = imageData.width;
      const height = imageData.height;
      const mask = new Uint8ClampedArray(width * height);

      for (let i = 0, j = 0; i < data.length; i += 4, j++) {
        const r = data[i] / 255;
        const g = data[i + 1] / 255;
        const b = data[i + 2] / 255;

        const { h, s, v } = rgbToHsv(r, g, b);

        // Use low brightness (v) and low saturation (s) to identify shadow-like pixels
        if (v < valueDrop && s < satDrop) {
          mask[j] = 1;
        } else {
          mask[j] = 0;
        }
      }

      return mask;
    }

    function rgbToHsv(r, g, b) {
      const max = Math.max(r, g, b), min = Math.min(r, g, b);
      let h = 0, s, v = max;
      const d = max - min;

      s = max === 0 ? 0 : d / max;

      if (max !== min) {
        if (max === r) h = (g - b) / d + (g < b ? 6 : 0);
        else if (max === g) h = (b - r) / d + 2;
        else if (max === b) h = (r - g) / d + 4;
        h /= 6;
      }

      return { h, s, v };
    }

    // Helper: Convert Blob to Base64
    async function blobToBase64(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }

    // Helper: Resize an image to max width/height (returns base64)
    async function resizeImage(base64, maxWidthPx, maxHeightPx) {
      return new Promise((resolve) => {
        const img = new Image();
        img.onload = () => {
          let width = img.width;
          let height = img.height;

          // Maintain aspect ratio
          const aspect = width / height;
          if (width > maxWidthPx || height > maxHeightPx) {
            if (width / maxWidthPx > height / maxHeightPx) {
              width = maxWidthPx;
              height = width / aspect;
            } else {
              height = maxHeightPx;
              width = height * aspect;
            }
          }

          const canvas = document.createElement("canvas");
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext("2d");
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL("image/jpeg", 0.9)); // 0.9 = high quality JPEG
        };
        img.src = base64;
      });
    }

    document.querySelector('#generatepptx').addEventListener('click', async () => {
      const pptx = new PptxGenJS();
      const slideWidth = 8.27;  // A4 width in inches
      const slideHeight = 11.69; // A4 height in inches
      pptx.defineLayout({ name: 'A4', width: slideWidth, height: slideHeight });
      pptx.layout = 'A4';
      const DPI = 96;

      let imagesarray = Array.from(document.querySelectorAll('img'));

      if (imagesarray.length && typeof images !== 'undefined' && images.length > 0) {
        imagesarray = await Promise.all(images.map(async (e) => {
          let src = e.img.src;
          if (src.startsWith('blob:')) {
            const response = await fetch(src);
            const blob = await response.blob();
            src = await blobToBase64(blob);            
          }
          return { src };
        }));
      }

      for (let img of imagesarray) {
        const src = img.src || img.getAttribute?.('src');
        if (!src || !src.startsWith("data:image")) continue;

        // Load to get dimensions
        const image = new Image();
        image.src = src;
        await new Promise((resolve) => (image.onload = resolve));

        // Convert pixels to inches
        const imgWidthIn = image.naturalWidth / DPI;
        const imgHeightIn = image.naturalHeight / DPI;

        // If image too large (e.g., > A4 × 2), resize before adding
        const maxWidthPx = slideWidth * DPI;
        const maxHeightPx = slideHeight * DPI;
        let finalSrc = src;

        if (image.naturalWidth > maxWidthPx * 2 || image.naturalHeight > maxHeightPx * 2) {
          console.log("Resizing heavy image...");
          finalSrc = await resizeImage(src, maxWidthPx, maxHeightPx);
        }

        // Scale to fit A4 width
        const aspectRatio = imgHeightIn / imgWidthIn;
        const widthInInches = slideWidth;
        const heightInInches = widthInInches * aspectRatio;
        const yOffset = Math.max((slideHeight - heightInInches) / 2, 0);

        const slide = pptx.addSlide();
        slide.addImage({
          data: finalSrc,
          x: 0,
          y: yOffset,
          w: widthInInches,
          h: heightInInches,
        });
      }

// Add final slide with #output text made of divs
const outputEl = document.querySelector('#output');
if (outputEl && outputEl.textContent.trim() !== '') {
  const finalSlide = pptx.addSlide();

  // Collect each child div's text
  const lines = Array.from(outputEl.children)
    .map(div => div.innerText.trim())
    .filter(line => line.length > 0);

  // Join with \r to preserve line breaks in one text box
  const formattedText = lines.join('\n');

  finalSlide.addText(formattedText, {
    x: 0.5,
    y: 0.5,
    w: slideWidth - 1,
    h: slideHeight - 1,
    fontSize: 18,
    color: '363636',
    align: 'left',
    valign: 'top',
    wrap: true,
    margin: 0 // Remove text box padding/margin
  });
}

      let name = "a4-images-presentation.pptx";
      const userFilename = document.querySelector('#output div')?.innerText.trim();
      if (userFilename) name = userFilename + ".pptx";
      await pptx.writeFile(name);
    });



    document.querySelector("#idcardcapture").addEventListener("click", async () => {
      let stream;

      const videoContainer = document.getElementById("video-container");
      const video = document.getElementById("camera");
      const capturedPhoto = document.getElementById("capturedPhoto");

      // Create or get buttons container
      let buttonsContainer = document.getElementById("buttons-container");
      if (!buttonsContainer) {
        buttonsContainer = document.createElement("div");
        buttonsContainer.id = "buttons-container";
        Object.assign(buttonsContainer.style, {
          marginTop: "10px",
          display: "flex",
          justifyContent: "center",
          gap: "10px",
        });
        document.body.appendChild(buttonsContainer);
      }
      buttonsContainer.style.display = "flex";

      // Helper to create button if missing
      function createButton(id, text, display = "inline-block") {
        let btn = buttonsContainer.querySelector(`#${id}`);
        if (!btn) {
          btn = document.createElement("button");
          btn.id = id;
          btn.textContent = text;
          buttonsContainer.appendChild(btn);
        }
        btn.style.display = display;
        btn.setAttribute("aria-label", text);
        return btn;
      }

      const captureBtn = createButton("captureBtn", "📸 Capture");
      const resetBtn = createButton("resetBtn", "🔄 Retake", "none");
      const captureAnotherBtn = createButton("captureAnotherBtn", "Capture Another", "none");

      // Disable capture button until video is ready
      captureBtn.disabled = true;

      async function startCamera() {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }

        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          //stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" } });
          video.srcObject = stream;
          video.muted = true;
          await video.play();

          videoContainer.style.display = "block";
          capturedPhoto.style.display = "none";

          captureBtn.style.display = "inline-block";
          captureBtn.disabled = false; // enable capture now that video is playing
          resetBtn.style.display = "none";
          captureAnotherBtn.style.display = "none";
        } catch (err) {
          alert("Camera access failed: " + err.message);
          console.error(err);
        }
      }

      function capturePhoto() {
        if (!video.videoWidth || !video.videoHeight) {
          return alert("Video not ready");
        }

        const canvas = document.createElement("canvas");
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        canvas.getContext("2d").drawImage(video, 0, 0);

        // Use quality parameter (0.8)
        capturedPhoto.src = canvas.toDataURL("image/jpeg", 0.8);

        if (stream) {
          stream.getTracks().forEach(t => t.stop());
          stream = null;
        }

        videoContainer.style.display = "none";
        capturedPhoto.style.display = "block";

        captureBtn.style.display = "none";
        resetBtn.style.display = "inline-block";
        captureAnotherBtn.style.display = "inline-block";
      }

      function resetCamera() {
        capturedPhoto.src = "";
        capturedPhoto.style.display = "none";
        videoContainer.style.display = "block";

        captureBtn.disabled = true; // disable until video ready again

        startCamera();
      }

      captureBtn.onclick = capturePhoto;
      resetBtn.onclick = resetCamera;
      captureAnotherBtn.onclick = resetCamera;

      // Clean up stream on page unload
      window.addEventListener("beforeunload", () => {
        if (stream) {
          stream.getTracks().forEach(t => t.stop());
        }
      });

      startCamera();
    });

    document.querySelector('#idcardsgenerate').addEventListener("click", function () {
      // Clone the table node
      const clonedNode = document.querySelector('#array table').cloneNode(true);
      // Set padding style
      clonedNode.style.paddingTop = '0.1in';
      clonedNode.style.margin = '0 auto';
      clonedNode.style.borderSpacing = '45px 15px';
      clonedNode.dir = "rtl"
      // Append the cloned node
      document.querySelector("#array").appendChild(clonedNode);

      const imgSrc = URL.createObjectURL(fileListPdf[0].file);
      const img = document.createElement("img");
      img.src = imgSrc;

      // Ask the user how many <td> elements should receive the image
      let numAppends = parseInt(prompt("How many <td> cells should get the image?"), 10);

      // Select all <td> elements
      const tdElements = document.querySelectorAll("table:nth-child(1) td");

      let count = 0;
      tdElements.forEach((td, index) => {
        if (count < numAppends && !td.querySelector("img")) {
          td.appendChild(img.cloneNode(true));

          const chi = document.createElement("img");
          chi.src = URL.createObjectURL(fileListPdf[1].file);
          document.querySelectorAll("table:nth-child(2) td")[index].appendChild(chi);

          count++;
        }
      });

      document.querySelectorAll("img").forEach(function (e) {
        e.style.width = "3.4in";
        e.style.height = "2.2in";
      });
      document.querySelector("table").style.margin = "0 auto";
      document.querySelector("table").style.borderSpacing = "45px 15px";
      document.querySelector("table").style.pageBreakAfter = "always";

      /*
  
      // Ask the user
    const printType = confirm("Click OK for double-sided printing, or Cancel for single-sided printing.");
  
  if (printType) {
    // Clone the table node
    const clonedNode = document.querySelector('#array table').cloneNode(true);
  
    // Set padding style
    clonedNode.style.paddingTop = '0.1in';
  
    // Append the cloned node
    document.querySelector("#array").appendChild(clonedNode);
    window.print();
  } else{
    window.print();
    window.print();
  }
    */

    })

    /*
    document.querySelector('#embedsvgimages').addEventListener("click", function(){
      document.querySelectorAll("svg image").forEach(function(e) {
        let href = e.getAttribute("href") || e.getAttribute("xlink:href");
        if (href) {
            window.open(href, '_blank');
        }
    });
    })
    */

    document.querySelector('#embedsvgimages').addEventListener("click", async function () {
      const images = document.querySelectorAll("svg image");
      for (const e of images) {
        const href = e.getAttribute("href") || e.getAttribute("xlink:href");
        if (href) {
          try {
            const response = await fetch(href);
            const blob = await response.blob();
            const file = new File([blob], "embedded-image.png", { type: blob.type });
            await processFile(file);
          } catch (err) {
            console.error(`Error processing image ${href}:`, err);
          }
        }
      }
    });

    /*
    document.querySelector('#embedsvgimages').addEventListener("click", async function () {
    const images = document.querySelectorAll("svg image");
    for (const e of images) {
      const href = e.getAttribute("href") || e.getAttribute("xlink:href");
      if (href) {
        try {
          const response = await fetch(href);
          const blob = await response.blob();
    
          // Load image to check its dimensions
          const img = new Image();
          const objectURL = URL.createObjectURL(blob);
    
          await new Promise((resolve, reject) => {
            img.onload = () => {
              // Skip small watermark images, e.g., width < 100 and height < 50
              if (img.width < 100 && img.height < 50) {
                console.log("Skipped small image (possible watermark):", href);
                resolve(); // skip processing
              } else {
                const file = new File([blob], "embedded-image.png", { type: blob.type });
                processFile(file).then(resolve).catch(reject);
              }
              URL.revokeObjectURL(objectURL);
            };
            img.onerror = reject;
            img.src = objectURL;
          });
        } catch (err) {
          console.error(`Error processing image ${href}:`, err);
        }
      }
    }
    });
    */

    function otsuThreshold(gray) {
      const hist = new Array(256).fill(0);
      const total = gray.length;

      for (let i = 0; i < gray.length; i++) {
        hist[gray[i]]++;
      }

      let sum = 0;
      for (let t = 0; t < 256; t++) sum += t * hist[t];

      let sumB = 0, wB = 0, wF = 0, varMax = 0;
      let threshold = 0;

      for (let t = 0; t < 256; t++) {
        wB += hist[t];
        if (wB === 0) continue;

        wF = total - wB;
        if (wF === 0) break;

        sumB += t * hist[t];

        const mB = sumB / wB;
        const mF = (sum - sumB) / wF;

        const varBetween = wB * wF * (mB - mF) ** 2;
        if (varBetween > varMax) {
          varMax = varBetween;
          threshold = t;
        }
      }

      return threshold;
    }

    function segmentImageByOtsu() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const gray = new Uint8Array(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      const threshold = otsuThreshold(gray);
      console.log("Otsu Threshold:", threshold);

      for (let i = 0; i < gray.length; i++) {
        const val = gray[i] < threshold ? 0 : 255;
        const idx = i * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255;
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function applyHighPassFilter() {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // High-pass kernel (sharpening)
      const kernel = [
        -1, -1, -1,
        -1, 8, -1,
        -1, -1, -1
      ];

      const output = new Uint8ClampedArray(gray.length);

      // Apply convolution
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          let sum = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              const px = x + kx;
              const py = y + ky;
              const pixelVal = gray[py * width + px];
              const kernelVal = kernel[(ky + 1) * 3 + (kx + 1)];
              sum += pixelVal * kernelVal;
            }
          }

          // Clamp the result between 0 and 255
          const idx = y * width + x;
          output[idx] = Math.min(255, Math.max(0, sum));
        }
      }

      // Copy result back to image data
      for (let i = 0; i < output.length; i++) {
        const val = output[i];
        const idx = i * 4;
        data[idx] = data[idx + 1] = data[idx + 2] = val;
        data[idx + 3] = 255; // full alpha
      }

      ctx.putImageData(imageData, 0, 0);
    }


    function adaptiveLuminanceSegmentation(blockSize = 15, offset = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Build integral image
      const integral = new Float64Array((width + 1) * (height + 1));
      for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
          const idx = (y - 1) * width + (x - 1);
          const integralIdx = y * (width + 1) + x;
          integral[integralIdx] =
            gray[idx] +
            integral[(y - 1) * (width + 1) + x] +
            integral[y * (width + 1) + (x - 1)] -
            integral[(y - 1) * (width + 1) + (x - 1)];
        }
      }

      // Clamp helper to fit integral image indexing and avoid negative area
      function getSum(x1, y1, x2, y2) {
        x1 = Math.max(0, Math.min(width - 1, x1));
        y1 = Math.max(0, Math.min(height - 1, y1));
        x2 = Math.max(0, Math.min(width - 1, x2));
        y2 = Math.max(0, Math.min(height - 1, y2));

        if (x2 < x1 || y2 < y1) return 0;

        const A = integral[y1 * (width + 1) + x1];
        const B = integral[y1 * (width + 1) + (x2 + 1)];
        const C = integral[(y2 + 1) * (width + 1) + x1];
        const D = integral[(y2 + 1) * (width + 1) + (x2 + 1)];
        return D - B - C + A;
      }

      const result = new Uint8ClampedArray(data.length);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;

          const x1 = x - blockSize;
          const y1 = y - blockSize;
          const x2 = x + blockSize;
          const y2 = y + blockSize;

          const left = Math.max(0, x1);
          const top = Math.max(0, y1);
          const right = Math.min(width - 1, x2);
          const bottom = Math.min(height - 1, y2);

          const area = (right - left + 1) * (bottom - top + 1);

          const localMean = getSum(x1, y1, x2, y2) / area;
          const lum = gray[idx];

          const val = lum < localMean - offset ? 0 : 255;

          result[idx * 4] = result[idx * 4 + 1] = result[idx * 4 + 2] = val;
          result[idx * 4 + 3] = 255;
        }
      }

      const newImage = new ImageData(result, width, height);
      ctx.putImageData(newImage, 0, 0);
    }

    function adaptiveLuminanceMaskColor(blockSize = 15, offset = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Build integral image
      const integral = new Float64Array((width + 1) * (height + 1));
      for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
          const idx = (y - 1) * width + (x - 1);
          const integralIdx = y * (width + 1) + x;
          integral[integralIdx] =
            gray[idx] +
            integral[(y - 1) * (width + 1) + x] +
            integral[y * (width + 1) + (x - 1)] -
            integral[(y - 1) * (width + 1) + (x - 1)];
        }
      }

      // Helper to get sum over a region
      function getSum(x1, y1, x2, y2) {
        x1 = Math.max(0, Math.min(width - 1, x1));
        y1 = Math.max(0, Math.min(height - 1, y1));
        x2 = Math.max(0, Math.min(width - 1, x2));
        y2 = Math.max(0, Math.min(height - 1, y2));
        if (x2 < x1 || y2 < y1) return 0;

        const A = integral[y1 * (width + 1) + x1];
        const B = integral[y1 * (width + 1) + (x2 + 1)];
        const C = integral[(y2 + 1) * (width + 1) + x1];
        const D = integral[(y2 + 1) * (width + 1) + (x2 + 1)];
        return D - B - C + A;
      }

      const result = new Uint8ClampedArray(data.length);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;

          const x1 = x - blockSize;
          const y1 = y - blockSize;
          const x2 = x + blockSize;
          const y2 = y + blockSize;

          const left = Math.max(0, x1);
          const top = Math.max(0, y1);
          const right = Math.min(width - 1, x2);
          const bottom = Math.min(height - 1, y2);

          const area = (right - left + 1) * (bottom - top + 1);
          const localMean = getSum(x1, y1, x2, y2) / area;
          const lum = gray[idx];

          // ✅ Inverted logic: keep dark regions
          const keep = lum < localMean - offset;
          const i = idx * 4;

          if (keep) {
            result[i] = data[i];         // R
            result[i + 1] = data[i + 1]; // G
            result[i + 2] = data[i + 2]; // B
            result[i + 3] = 255;         // Opaque
          } else {
            result[i] = 0;
            result[i + 1] = 0;
            result[i + 2] = 0;
            result[i + 3] = 0;           // Transparent
          }
        }
      }

      const newImage = new ImageData(result, width, height);
      ctx.clearRect(0, 0, width, height); // Clear canvas for transparency
      ctx.putImageData(newImage, 0, 0);
    }

    function adaptiveLuminanceMaskWithContours(blockSize = 15, offset = 10, minContourSize = 50) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert to grayscale
      const gray = new Uint8ClampedArray(width * height);
      for (let i = 0; i < data.length; i += 4) {
        gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
      }

      // Build integral image for adaptive mean
      const integral = new Float64Array((width + 1) * (height + 1));
      for (let y = 1; y <= height; y++) {
        for (let x = 1; x <= width; x++) {
          const idx = (y - 1) * width + (x - 1);
          const integralIdx = y * (width + 1) + x;
          integral[integralIdx] =
            gray[idx] +
            integral[(y - 1) * (width + 1) + x] +
            integral[y * (width + 1) + (x - 1)] -
            integral[(y - 1) * (width + 1) + (x - 1)];
        }
      }

      // Helper to get sum over a region
      function getSum(x1, y1, x2, y2) {
        x1 = Math.max(0, Math.min(width - 1, x1));
        y1 = Math.max(0, Math.min(height - 1, y1));
        x2 = Math.max(0, Math.min(width - 1, x2));
        y2 = Math.max(0, Math.min(height - 1, y2));
        if (x2 < x1 || y2 < y1) return 0;

        const A = integral[y1 * (width + 1) + x1];
        const B = integral[y1 * (width + 1) + (x2 + 1)];
        const C = integral[(y2 + 1) * (width + 1) + x1];
        const D = integral[(y2 + 1) * (width + 1) + (x2 + 1)];
        return D - B - C + A;
      }

      // Compute Sobel edges (binary mask)
      function computeSobelEdges(gray, width, height, threshold = 100) {
        const edges = new Uint8ClampedArray(width * height);
        for (let y = 1; y < height - 1; y++) {
          for (let x = 1; x < width - 1; x++) {
            const idx = y * width + x;

            const gx =
              -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
              -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
              -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];

            const gy =
              -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
              gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];

            const mag = Math.sqrt(gx * gx + gy * gy);

            edges[idx] = mag > threshold ? 1 : 0;
          }
        }
        return edges;
      }

      // Find connected components (contours) in mask using DFS
      function findConnectedComponents(mask, width, height) {
        const labels = new Int32Array(width * height).fill(-1);
        let currentLabel = 0;
        const neighbors = [
          [-1, 0], [1, 0], [0, -1], [0, 1]
        ];

        function inBounds(x, y) {
          return x >= 0 && x < width && y >= 0 && y < height;
        }

        for (let i = 0; i < mask.length; i++) {
          if (mask[i] === 0 || labels[i] !== -1) continue;

          // BFS or DFS
          const stack = [i];
          labels[i] = currentLabel;
          while (stack.length) {
            const idx = stack.pop();
            const x = idx % width;
            const y = Math.floor(idx / width);

            for (const [dx, dy] of neighbors) {
              const nx = x + dx;
              const ny = y + dy;
              if (!inBounds(nx, ny)) continue;
              const nidx = ny * width + nx;
              if (mask[nidx] === 1 && labels[nidx] === -1) {
                labels[nidx] = currentLabel;
                stack.push(nidx);
              }
            }
          }

          currentLabel++;
        }

        return { labels, count: currentLabel };
      }

      // === Step 1: Create initial mask with adaptive luminance inverted logic + edges combined ===
      const initialMask = new Uint8ClampedArray(width * height);
      const edges = computeSobelEdges(gray, width, height, 100);

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;

          const x1 = x - blockSize;
          const y1 = y - blockSize;
          const x2 = x + blockSize;
          const y2 = y + blockSize;

          const left = Math.max(0, x1);
          const top = Math.max(0, y1);
          const right = Math.min(width - 1, x2);
          const bottom = Math.min(height - 1, y2);

          const area = (right - left + 1) * (bottom - top + 1);
          const localMean = getSum(x1, y1, x2, y2) / area;
          const lum = gray[idx];

          // Inverted luminance threshold OR edge pixel
          initialMask[idx] = (lum < localMean - offset || edges[idx] === 1) ? 1 : 0;
        }
      }

      // === Step 2: Find contours (connected components) in initial mask ===
      const { labels, count } = findConnectedComponents(initialMask, width, height);

      // === Step 3: Calculate contour sizes ===
      const contourSizes = new Array(count).fill(0);
      for (let i = 0; i < labels.length; i++) {
        if (labels[i] >= 0) contourSizes[labels[i]]++;
      }

      // === Step 4: Create final mask — keep pixels that belong to sufficiently large contours ===
      // This preserves small logos/shapes by keeping contours bigger than minContourSize
      const finalMask = new Uint8ClampedArray(width * height);
      for (let i = 0; i < labels.length; i++) {
        const label = labels[i];
        finalMask[i] = (label >= 0 && contourSizes[label] >= minContourSize) ? 1 : 0;
      }

      // === Step 5: Apply final mask to original color image ===
      const result = new Uint8ClampedArray(data.length);
      for (let i = 0; i < width * height; i++) {
        const pixelIndex = i * 4;
        if (finalMask[i] === 1) {
          // Keep original color
          result[pixelIndex] = data[pixelIndex];
          result[pixelIndex + 1] = data[pixelIndex + 1];
          result[pixelIndex + 2] = data[pixelIndex + 2];
          result[pixelIndex + 3] = 255; // opaque
        } else {
          // Transparent
          result[pixelIndex] = 0;
          result[pixelIndex + 1] = 0;
          result[pixelIndex + 2] = 0;
          result[pixelIndex + 3] = 0; // transparent
        }
      }

      // Render result back on canvas
      const newImage = new ImageData(result, width, height);
      ctx.clearRect(0, 0, width, height);
      ctx.putImageData(newImage, 0, 0);
    }

    async function extractContoursHybrid({
  blockSize = 15,
  offset = 10,
  dtThreshold = 2,
  morphIterations = 1
} = {}) {
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const width = canvas.width;
  const height = canvas.height;

  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // === 1. Grayscale ===
  const gray = new Uint8ClampedArray(width * height);
  for (let i = 0; i < data.length; i += 4) {
    gray[i / 4] = 0.299 * data[i] + 0.587 * data[i + 1] + 0.114 * data[i + 2];
  }

  // === 2. OTSU THRESHOLD ===
  function otsu(gray) {
    const hist = new Array(256).fill(0);
    for (let i = 0; i < gray.length; i++) hist[gray[i]]++;
    const total = gray.length;
    let sum = 0;
    for (let i = 0; i < 256; i++) sum += i * hist[i];
    let sumB = 0, wB = 0, wF = 0;
    let maxVar = 0, threshold = 0;
    for (let t = 0; t < 256; t++) {
      wB += hist[t];
      if (wB === 0) continue;
      wF = total - wB;
      if (wF === 0) break;
      sumB += t * hist[t];
      const mB = sumB / wB;
      const mF = (sum - sumB) / wF;
      const variance = wB * wF * (mB - mF) ** 2;
      if (variance > maxVar) {
        maxVar = variance;
        threshold = t;
      }
    }
    return threshold;
  }

  const otsuThreshold = otsu(gray);
  const otsuMask = new Uint8ClampedArray(width * height);
  for (let i = 0; i < gray.length; i++) otsuMask[i] = gray[i] < otsuThreshold ? 1 : 0;

  // === 3. Integral Image ===
  const integral = new Float64Array((width + 1) * (height + 1));
  for (let y = 1; y <= height; y++) {
    for (let x = 1; x <= width; x++) {
      const idx = (y - 1) * width + (x - 1);
      const iIdx = y * (width + 1) + x;
      integral[iIdx] = gray[idx] + integral[(y - 1) * (width + 1) + x] + integral[y * (width + 1) + (x - 1)] - integral[(y - 1) * (width + 1) + (x - 1)];
    }
  }

  function getSum(x1, y1, x2, y2) {
    x1 = Math.max(0, x1); y1 = Math.max(0, y1);
    x2 = Math.min(width - 1, x2); y2 = Math.min(height - 1, y2);
    const A = integral[y1 * (width + 1) + x1];
    const B = integral[y1 * (width + 1) + (x2 + 1)];
    const C = integral[(y2 + 1) * (width + 1) + x1];
    const D = integral[(y2 + 1) * (width + 1) + (x2 + 1)];
    return D - B - C + A;
  }

  // === 4. Adaptive mask ===
  const adaptiveMask = new Uint8ClampedArray(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = y * width + x;
      const mean = getSum(x - blockSize, y - blockSize, x + blockSize, y + blockSize) / ((blockSize * 2 + 1) ** 2);
      adaptiveMask[i] = gray[i] < mean - offset ? 1 : 0;
    }
  }

  // === 5. Sobel edges ===
  function sobel() {
    const edges = new Uint8ClampedArray(width * height);
    for (let y = 1; y < height - 1; y++) {
      for (let x = 1; x < width - 1; x++) {
        const i = y * width + x;
        const gx = -gray[(y - 1) * width + (x - 1)] + gray[(y - 1) * width + (x + 1)] +
                   -2 * gray[y * width + (x - 1)] + 2 * gray[y * width + (x + 1)] +
                   -gray[(y + 1) * width + (x - 1)] + gray[(y + 1) * width + (x + 1)];
        const gy = -gray[(y - 1) * width + (x - 1)] - 2 * gray[(y - 1) * width + x] - gray[(y - 1) * width + (x + 1)] +
                   gray[(y + 1) * width + (x - 1)] + 2 * gray[(y + 1) * width + x] + gray[(y + 1) * width + (x + 1)];
        edges[i] = Math.sqrt(gx * gx + gy * gy) > 100 ? 1 : 0;
      }
    }
    return edges;
  }
  const edges = sobel();

  // === 6. HYBRID MASK ===
  let mask = new Uint8ClampedArray(width * height);
  for (let i = 0; i < mask.length; i++) mask[i] = ((adaptiveMask[i] && otsuMask[i]) || edges[i]) ? 1 : 0;

  // === 7. Morphology ===
  function dilate(m) {
    const o = m.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx>=0 && ny>=0 && nx<width && ny<height && m[ny*width+nx]) v=1;
          }
        }
        o[y*width+x]=v;
      }
    }
    return o;
  }
  function erode(m) {
    const o = m.slice();
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        let v = 1;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx<0||ny<0||nx>=width||ny>=height||!m[ny*width+nx]) v=0;
          }
        }
        o[y*width+x]=v;
      }
    }
    return o;
  }
  for (let i=0;i<morphIterations;i++) mask=dilate(mask);
  for (let i=0;i<morphIterations;i++) mask=erode(mask);

  // === 8. Distance transform ===
  const dist = new Float32Array(width*height);
  for (let i=0;i<mask.length;i++) dist[i]=mask[i]?0:Infinity;
  for (let i=0;i<dist.length;i++){
    if (i%width) dist[i]=Math.min(dist[i],dist[i-1]+1);
    if (i>=width) dist[i]=Math.min(dist[i],dist[i-width]+1);
  }
  for (let i=dist.length-1;i>=0;i--){
    if (i%width!==width-1) dist[i]=Math.min(dist[i],dist[i+1]+1);
    if (i<dist.length-width) dist[i]=Math.min(dist[i],dist[i+width]+1);
  }
  for (let i=0;i<mask.length;i++) mask[i]=dist[i]<=dtThreshold?1:0;

  // === 9. APPLY MASK TO ORIGINAL CANVAS ===
  const out = new Uint8ClampedArray(data.length);
  for (let i=0;i<mask.length;i++){
    const p=i*4;
    if (mask[i]){
      out[p]=data[p];
      out[p+1]=data[p+1];
      out[p+2]=data[p+2];
      out[p+3]=255;
    } else {
      out[p]=0;
      out[p+1]=0;
      out[p+2]=0;
      out[p+3]=0;
    }
  }

  ctx.putImageData(new ImageData(out, width, height), 0, 0);
  console.log("Background removed, contours preserved.");
}

    function unsharpMasking(amount = 1.0, radius = 1.0, threshold = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data); // copy of original data
      const blurred = gaussianBlur(original, width, height, radius);

      for (let i = 0; i < imageData.data.length; i += 4) {
        for (let c = 0; c < 3; c++) {
          const diff = original[i + c] - blurred[i + c];
          if (Math.abs(diff) > threshold) {
            let sharp = original[i + c] + amount * diff;
            sharp = Math.round(sharp);
            imageData.data[i + c] = Math.min(255, Math.max(0, sharp));
          } else {
            // No change if difference is below threshold
            imageData.data[i + c] = original[i + c];
          }
        }
        imageData.data[i + 3] = original[i + 3]; // preserve alpha
      }

      ctx.putImageData(imageData, 0, 0);
    }


    function laplacianEdgeAwareEnhancement({
      edgeStrength = 1.0,
      bilateralRadius = 3,
      sigmaSpatial = 3.0,
      sigmaRange = 30.0,
      adaptiveScaling = true,
      edgeSharpness = 0.1
    } = {}) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data); // Copy original

      // 1. Precompute spatial Gaussian weights for bilateral filter
      const diameter = bilateralRadius * 2 + 1;
      const spatialWeights = new Float32Array(diameter * diameter);
      let idxWeight = 0;
      for (let dy = -bilateralRadius; dy <= bilateralRadius; dy++) {
        for (let dx = -bilateralRadius; dx <= bilateralRadius; dx++) {
          const dist2 = dx * dx + dy * dy;
          spatialWeights[idxWeight++] = Math.exp(-dist2 / (2 * sigmaSpatial * sigmaSpatial));
        }
      }

      // 2. Apply bilateral filter on RGB channels only (skip borders)
      const bilateral = new Uint8ClampedArray(original.length);
      bilateral.set(original); // Initialize edges directly (for border pixels)

      // Helper function: pixel index
      const idx = (x, y) => (y * width + x) * 4;

      for (let y = bilateralRadius; y < height - bilateralRadius; y++) {
        for (let x = bilateralRadius; x < width - bilateralRadius; x++) {
          const centerIdx = idx(x, y);

          for (let c = 0; c < 3; c++) {
            const centerVal = original[centerIdx + c];
            let sum = 0, norm = 0;
            let wIdx = 0;

            for (let dy = -bilateralRadius; dy <= bilateralRadius; dy++) {
              for (let dx = -bilateralRadius; dx <= bilateralRadius; dx++) {
                const neighborIdx = idx(x + dx, y + dy);
                const neighborVal = original[neighborIdx + c];

                // Compute range weight based on intensity difference
                const diff = centerVal - neighborVal;
                const rangeWeight = Math.exp(- (diff * diff) / (2 * sigmaRange * sigmaRange));

                // Combined weight
                const weight = spatialWeights[wIdx++] * rangeWeight;

                sum += weight * neighborVal;
                norm += weight;
              }
            }
            bilateral[centerIdx + c] = norm > 0 ? sum / norm : centerVal;
          }
          bilateral[centerIdx + 3] = 255; // alpha stays opaque
        }
      }

      // 3. Compute Laplacian on bilateral filtered image
      const laplacianKernel = [
        0, 1, 0,
        1, -4, 1,
        0, 1, 0
      ];
      const laplacian = new Float32Array(original.length);

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const centerIdx = idx(x, y);

          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let k = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const neighborIdx = idx(x + kx, y + ky);
                sum += laplacianKernel[k++] * bilateral[neighborIdx + c];
              }
            }
            laplacian[centerIdx + c] = sum;
          }
        }
      }

      // 4. Compute edge magnitude map & apply adaptive enhancement
      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          const centerIdx = idx(x, y);

          // Edge magnitude is mean absolute Laplacian across channels
          const edgeMag = (
            Math.abs(laplacian[centerIdx]) +
            Math.abs(laplacian[centerIdx + 1]) +
            Math.abs(laplacian[centerIdx + 2])
          ) / 3;

          let weight;
          if (adaptiveScaling) {
            // Smooth sigmoid-like scaling to avoid harsh thresholding
            weight = edgeStrength * (edgeMag / (edgeMag + edgeSharpness * 255));
          } else {
            weight = edgeMag > 20 ? edgeStrength : 0;
          }

          // Apply enhancement to original image
          for (let c = 0; c < 3; c++) {
            const enhanced = original[centerIdx + c] - weight * laplacian[centerIdx + c];
            imageData.data[centerIdx + c] = Math.min(255, Math.max(0, enhanced));
          }
          imageData.data[centerIdx + 3] = 255; // preserve alpha
        }
      }

      // For border pixels (1 px edges), copy original without modification
      for (let y = 0; y < height; y++) {
        for (let x of [0, width - 1]) {
          const i = idx(x, y);
          for (let c = 0; c < 4; c++) {
            imageData.data[i + c] = original[i + c];
          }
        }
      }
      for (let x = 0; x < width; x++) {
        for (let y of [0, height - 1]) {
          const i = idx(x, y);
          for (let c = 0; c < 4; c++) {
            imageData.data[i + c] = original[i + c];
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }


    function bilateralFilter(data, width, height, radius, sigmaSpatial, sigmaRange) {
      const output = new Uint8ClampedArray(data.length);
      const spatialWeights = [];

      for (let dy = -radius; dy <= radius; dy++) {
        for (let dx = -radius; dx <= radius; dx++) {
          const dist2 = dx * dx + dy * dy;
          spatialWeights.push(Math.exp(-dist2 / (2 * sigmaSpatial * sigmaSpatial)));
        }
      }

      const idx = (x, y) => (y * width + x) * 4;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const centerIdx = idx(x, y);  // <-- Moved here inside the loop!

          for (let c = 0; c < 3; c++) {
            let sum = 0;
            let norm = 0;
            let i = 0;

            const centerVal = data[centerIdx + c];

            for (let dy = -radius; dy <= radius; dy++) {
              for (let dx = -radius; dx <= radius; dx++) {
                const nx = x + dx;
                const ny = y + dy;
                if (nx < 0 || ny < 0 || nx >= width || ny >= height) {
                  i++;
                  continue;
                }

                const nIdx = idx(nx, ny);
                const neighborVal = data[nIdx + c];
                const rangeWeight = Math.exp(
                  -Math.pow(centerVal - neighborVal, 2) / (2 * sigmaRange * sigmaRange)
                );
                const weight = spatialWeights[i] * rangeWeight;

                sum += weight * neighborVal;
                norm += weight;
                i++;
              }
            }

            output[centerIdx + c] = norm > 0 ? sum / norm : centerVal;
          }
          output[centerIdx + 3] = 255; // alpha
        }
      }

      return output;
    }


    function computeLaplacian(data, width, height) {
      const kernel = [
        0, 1, 0,
        1, -4, 1,
        0, 1, 0
      ];
      const output = new Float32Array(data.length);
      const idx = (x, y) => (y * width + x) * 4;

      for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
          for (let c = 0; c < 3; c++) {
            let sum = 0;
            for (let ky = -1; ky <= 1; ky++) {
              for (let kx = -1; kx <= 1; kx++) {
                const weight = kernel[(ky + 1) * 3 + (kx + 1)];
                const srcIdx = idx(x + kx, y + ky);
                sum += weight * data[srcIdx + c];
              }
            }
            output[idx(x, y) + c] = sum;
          }
        }
      }

      return output;
    }


    function edgeAwareAdaptiveThresholding(radius = 1.0, blockSize = 15, C = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data);
      const blurred = gaussianBlur(original, width, height, radius);

      const pixelCount = width * height;
      const gray = new Float32Array(pixelCount);
      const grayBlur = new Float32Array(pixelCount);
      const edgeMagnitude = new Float32Array(pixelCount);

      // Convert both original and blurred to grayscale
      for (let i = 0; i < pixelCount; i++) {
        const r1 = original[i * 4], g1 = original[i * 4 + 1], b1 = original[i * 4 + 2];
        const r2 = blurred[i * 4], g2 = blurred[i * 4 + 1], b2 = blurred[i * 4 + 2];
        const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

        gray[i] = gray1;
        grayBlur[i] = gray2;
        edgeMagnitude[i] = Math.abs(gray1 - gray2); // High-pass
      }

      // Normalize edgeMagnitude to [0, 1] without using spread
      const maxEdge = edgeMagnitude.reduce((max, val) => Math.max(max, val), -Infinity) || 1e-5;

      for (let i = 0; i < edgeMagnitude.length; i++) {
        edgeMagnitude[i] /= maxEdge;
      }


      // Build integral image of grayscale for fast local mean computation
      const integral = new Float32Array(pixelCount);

      for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          rowSum += gray[idx];
          integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
        }
      }

      // Helper to get sum from integral image in a region
      function getRegionSum(x0, y0, x1, y1) {
        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(width - 1, x1);
        y1 = Math.min(height - 1, y1);

        const A = integral[y0 * width + x0];
        const B = integral[y0 * width + x1];
        const C = integral[y1 * width + x0];
        const D = integral[y1 * width + x1];

        return D - B - C + A;
      }

      const halfBlock = Math.floor(blockSize / 2);

      // Apply adaptive threshold
      for (let y = 0; y < height; y++) {
        const y0 = y - halfBlock;
        const y1 = y + halfBlock;

        for (let x = 0; x < width; x++) {
          const x0 = x - halfBlock;
          const x1 = x + halfBlock;

          const idx = y * width + x;

          // Get local mean using integral image
          const regionWidth = x1 - x0 + 1;
          const regionHeight = y1 - y0 + 1;
          const count = regionWidth * regionHeight;

          const regionSum = getRegionSum(x0, y0, x1, y1);
          const localMean = regionSum / count;

          const edgeBoost = edgeMagnitude[idx] * C;
          const threshold = localMean - (C - edgeBoost);

          const value = gray[idx] >= threshold ? 255 : 0;

          const offset = idx * 4;
          imageData.data[offset] = imageData.data[offset + 1] = imageData.data[offset + 2] = value;
          imageData.data[offset + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }


    function gaussianBlur(data, width, height, radius) {
      const kernel = createGaussianKernel(radius);
      const temp = new Uint8ClampedArray(data.length);
      const output = new Uint8ClampedArray(data.length);

      // Horizontal pass
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let c = 0; c < 3; c++) {
            let acc = 0, weightSum = 0;
            for (let k = -radius; k <= radius; k++) {
              const ix = Math.min(width - 1, Math.max(0, x + k));
              const idx = 4 * (y * width + ix);
              acc += data[idx + c] * kernel[k + radius];
              weightSum += kernel[k + radius];
            }
            const idx = 4 * (y * width + x);
            temp[idx + c] = acc / weightSum;
          }
          temp[4 * (y * width + x) + 3] = 255;
        }
      }

      // Vertical pass
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          for (let c = 0; c < 3; c++) {
            let acc = 0, weightSum = 0;
            for (let k = -radius; k <= radius; k++) {
              const iy = Math.min(height - 1, Math.max(0, y + k));
              const idx = 4 * (iy * width + x);
              acc += temp[idx + c] * kernel[k + radius];
              weightSum += kernel[k + radius];
            }
            const idx = 4 * (y * width + x);
            output[idx + c] = acc / weightSum;
          }
          output[4 * (y * width + x) + 3] = 255;
        }
      }

      return output;
    }

    function createGaussianKernel(radius) {
      const kernelSize = 2 * radius + 1;
      const sigma = radius / 2;
      const kernel = new Float32Array(kernelSize);
      let sum = 0;

      for (let i = 0; i < kernelSize; i++) {
        const x = i - radius;
        kernel[i] = Math.exp(-(x * x) / (2 * sigma * sigma));
        sum += kernel[i];
      }

      // Normalize
      for (let i = 0; i < kernel.length; i++) {
        kernel[i] /= sum;
      }

      return kernel;
    }

    //function adaptiveHistogramEqualization(tileSize = 100, clipLimit = 35) {
    function adaptiveHistogramEqualization(tileSize = 130, clipLimit = 50) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const width = canvas.width;
      const height = canvas.height;

      // Create Lightness matrix (HSL)
      const lightness = new Array(height).fill(0).map(() => new Array(width).fill(0));
      const hslData = new Array(height).fill(0).map(() => new Array(width).fill([0, 0, 0]));

      function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)); break;
            case g: h = ((b - r) / d + 2); break;
            case b: h = ((r - g) / d + 4); break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        let r, g, b;

        if (s === 0) {
          r = g = b = l; // achromatic
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }

        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      // Convert image to HSL and extract Lightness
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          lightness[y][x] = Math.round(l * 255);
          hslData[y][x] = [h, s, l]; // store for later
        }
      }

      // CLAHE Functions
      function clipHistogram(hist, limit) {
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > limit) {
            excess += hist[i] - limit;
            hist[i] = limit;
          }
        }
        const redistribute = excess / 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += redistribute;
        }
        return hist;
      }

      function equalizeTileCLAHE(tile, clipLimit) {
        const hist = new Array(256).fill(0);
        for (let y = 0; y < tile.length; y++) {
          for (let x = 0; x < tile[0].length; x++) {
            hist[tile[y][x]]++;
          }
        }
        clipHistogram(hist, clipLimit);
        const cdf = hist.slice();
        for (let i = 1; i < 256; i++) {
          cdf[i] += cdf[i - 1];
        }
        const cdfMin = cdf.find(v => v > 0);
        const total = cdf[255];
        const lut = cdf.map(v => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));
        return tile.map(row => row.map(val => lut[val]));
      }

      // Apply CLAHE tile-wise
      for (let tileY = 0; tileY < height; tileY += tileSize) {
        for (let tileX = 0; tileX < width; tileX += tileSize) {
          const tile = [];
          for (let y = 0; y < tileSize && (tileY + y) < height; y++) {
            tile[y] = [];
            for (let x = 0; x < tileSize && (tileX + x) < width; x++) {
              tile[y][x] = lightness[tileY + y][tileX + x];
            }
          }

          const equalized = equalizeTileCLAHE(tile, clipLimit);

          for (let y = 0; y < equalized.length; y++) {
            for (let x = 0; x < equalized[0].length; x++) {
              const newL = equalized[y][x] / 255;
              const [h, s] = hslData[tileY + y][tileX + x];
              const [r, g, b] = hslToRgb(h, s, newL);
              const idx = ((tileY + y) * width + (tileX + x)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function adaptiveHistogramEqualizationReinhard(tileSize = 100, baseClipLimit = 35, useToneCurve = true) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      const width = canvas.width;
      const height = canvas.height;

      const lightness = new Array(height).fill(0).map(() => new Array(width).fill(0));
      const hslData = new Array(height).fill(0).map(() => new Array(width).fill([0, 0, 0]));

      function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;

        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        let r, g, b;
        if (s === 0) {
          r = g = b = l;
        } else {
          const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
          };
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      function clipHistogram(hist, limit) {
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > limit) {
            excess += hist[i] - limit;
            hist[i] = limit;
          }
        }
        const redistribute = excess / 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += redistribute;
        }
        return hist;
      }

      function equalizeTileCLAHE(tile, clipLimit) {
        const hist = new Array(256).fill(0);
        for (let y = 0; y < tile.length; y++) {
          for (let x = 0; x < tile[0].length; x++) {
            hist[tile[y][x]]++;
          }
        }
        clipHistogram(hist, clipLimit);
        const cdf = hist.slice();
        for (let i = 1; i < 256; i++) {
          cdf[i] += cdf[i - 1];
        }
        const cdfMin = cdf.find(v => v > 0);
        const total = cdf[255];
        const lut = cdf.map(v => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));
        return tile.map(row => row.map(val => lut[val]));
      }

      function computeLocalContrast(tile) {
        let min = 255, max = 0;
        for (const row of tile) {
          for (const val of row) {
            if (val < min) min = val;
            if (val > max) max = val;
          }
        }
        return max - min;
      }

      function applyToneCurve(l) {
        const x = l / 255;
        const y = 0.5 * (Math.sin(Math.PI * (x - 0.5)) + 1); // S-curve
        return Math.round(y * 255);
      }

      // Convert image to HSL and extract Lightness
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const i = (y * width + x) * 4;
          const [h, s, l] = rgbToHsl(data[i], data[i + 1], data[i + 2]);
          lightness[y][x] = Math.round(l * 255);
          hslData[y][x] = [h, s, l];
        }
      }

      // Process tiles with adaptive CLAHE
      for (let tileY = 0; tileY < height; tileY += tileSize) {
        for (let tileX = 0; tileX < width; tileX += tileSize) {
          const tile = [];
          for (let y = 0; y < tileSize && (tileY + y) < height; y++) {
            tile[y] = [];
            for (let x = 0; x < tileSize && (tileX + x) < width; x++) {
              tile[y][x] = lightness[tileY + y][tileX + x];
            }
          }

          const contrast = computeLocalContrast(tile);
          const adaptiveClip = Math.max(baseClipLimit * (contrast / 128), 5);
          const equalized = equalizeTileCLAHE(tile, adaptiveClip);

          for (let y = 0; y < equalized.length; y++) {
            for (let x = 0; x < equalized[0].length; x++) {
              let newL = equalized[y][x];
              if (useToneCurve) {
                newL = applyToneCurve(newL);
              }
              newL /= 255;
              const [h, s] = hslData[tileY + y][tileX + x];
              const [r, g, b] = hslToRgb(h, s, newL);
              const idx = ((tileY + y) * width + (tileX + x)) * 4;
              data[idx] = r;
              data[idx + 1] = g;
              data[idx + 2] = b;
            }
          }
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }


    function dualGammaCLAHE(tileSize = 64, clipLimit = 40, gammaLow = 0.6, gammaHigh = 1.5) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const { width, height } = canvas;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      const lightness = Array.from({ length: height }, () => new Array(width));
      const hslData = Array.from({ length: height }, () => new Array(width));

      function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h = 0, s = 0, l = (max + min) / 2;
        if (max !== min) {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
          }
          h /= 6;
        }
        return [h, s, l];
      }

      function hslToRgb(h, s, l) {
        const hue2rgb = (p, q, t) => {
          if (t < 0) t += 1;
          if (t > 1) t -= 1;
          if (t < 1 / 6) return p + (q - p) * 6 * t;
          if (t < 1 / 2) return q;
          if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
          return p;
        };
        let r, g, b;
        if (s === 0) r = g = b = l;
        else {
          const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
          const p = 2 * l - q;
          r = hue2rgb(p, q, h + 1 / 3);
          g = hue2rgb(p, q, h);
          b = hue2rgb(p, q, h - 1 / 3);
        }
        return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
      }

      // Extract lightness and cache HSL
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4;
          const [h, s, l] = rgbToHsl(data[idx], data[idx + 1], data[idx + 2]);
          hslData[y][x] = [h, s];
          lightness[y][x] = Math.round(l * 255);
        }
      }

      function clipHistogram(hist, limit) {
        let excess = 0;
        for (let i = 0; i < 256; i++) {
          if (hist[i] > limit) {
            excess += hist[i] - limit;
            hist[i] = limit;
          }
        }
        const increment = excess / 256;
        for (let i = 0; i < 256; i++) {
          hist[i] += increment;
        }
        return hist;
      }

      function computeCDF(tile, clipLimit) {
        const hist = new Array(256).fill(0);
        for (let y = 0; y < tile.length; y++) {
          for (let x = 0; x < tile[0].length; x++) {
            hist[tile[y][x]]++;
          }
        }
        clipHistogram(hist, clipLimit);
        const cdf = hist.slice();
        for (let i = 1; i < 256; i++) cdf[i] += cdf[i - 1];
        const cdfMin = cdf.find(v => v > 0);
        const total = cdf[255];
        const lut = cdf.map(v => Math.round(((v - cdfMin) / (total - cdfMin)) * 255));
        return lut;
      }

      function gammaCorrect(lut, gamma) {
        const corrected = new Array(256);
        for (let i = 0; i < 256; i++) {
          const g = Math.pow(i / 255, gamma) * 255;
          corrected[i] = Math.min(255, Math.max(0, Math.round(g)));
        }
        return corrected.map(i => lut[i]);
      }

      const tilesX = Math.ceil(width / tileSize);
      const tilesY = Math.ceil(height / tileSize);
      const luts = Array.from({ length: tilesY }, () => new Array(tilesX));

      for (let ty = 0; ty < tilesY; ty++) {
        for (let tx = 0; tx < tilesX; tx++) {
          const tile = [];
          for (let y = 0; y < tileSize && (ty * tileSize + y) < height; y++) {
            tile[y] = [];
            for (let x = 0; x < tileSize && (tx * tileSize + x) < width; x++) {
              tile[y][x] = lightness[ty * tileSize + y][tx * tileSize + x];
            }
          }
          const lut = computeCDF(tile, clipLimit);
          const low = gammaCorrect(lut, gammaLow);
          const high = gammaCorrect(lut, gammaHigh);
          luts[ty][tx] = { low, high };
        }
      }

      for (let y = 0; y < height; y++) {
        const ty = Math.floor(y / tileSize);
        const dy = (y % tileSize) / tileSize;
        for (let x = 0; x < width; x++) {
          const tx = Math.floor(x / tileSize);
          const dx = (x % tileSize) / tileSize;

          const l = lightness[y][x];
          const blendRatio = l / 255;

          function getLut(type, i, j) {
            const tY = Math.min(Math.max(j, 0), tilesY - 1);
            const tX = Math.min(Math.max(i, 0), tilesX - 1);
            return luts[tY][tX][type][l];
          }

          const ll = getLut("low", tx, ty);
          const lr = getLut("low", tx + 1, ty);
          const ul = getLut("low", tx, ty + 1);
          const ur = getLut("low", tx + 1, ty + 1);
          const lowVal = (1 - dx) * (1 - dy) * ll + dx * (1 - dy) * lr + (1 - dx) * dy * ul + dx * dy * ur;

          const hl = getLut("high", tx, ty);
          const hr = getLut("high", tx + 1, ty);
          const hu = getLut("high", tx, ty + 1);
          const hd = getLut("high", tx + 1, ty + 1);
          const highVal = (1 - dx) * (1 - dy) * hl + dx * (1 - dy) * hr + (1 - dx) * dy * hu + dx * dy * hd;

          // 🔄 Blend gamma-corrected values based on original lightness
          const finalL = Math.round((1 - blendRatio) * lowVal + blendRatio * highVal);
          const normL = Math.min(1, Math.max(0, finalL / 255));

          const [h, s] = hslData[y][x];
          const [r, g, b] = hslToRgb(h, s, normL);

          const idx = (y * width + x) * 4;
          data[idx] = r;
          data[idx + 1] = g;
          data[idx + 2] = b;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }


    document.querySelector('#textlayerdisplay').addEventListener("click", function () {
      document.querySelectorAll('.text-layer').forEach(function (e) {
        e.style.display = e.style.display === "none" ? "block" : "none";
      });

    })

    function openWhatsApp() {
      const phoneNumber = document.getElementById('filename').value.trim();

      if (phoneNumber) {
        const message = encodeURIComponent("Tanveer Studio!"); // Optional pre-filled message
        //const whatsappUrl = `https://wa.me/${phoneNumber}?text=${message}`;
        const whatsappUrl = `whatsapp://send?phone=92${phoneNumber}&text=${message}`;        
        //window.location.href = whatsappUrl

        window.open(whatsappUrl, '_blank'); // Opens in a new tab
      } else {
        alert("Please enter a valid phone number.");
      }
    }

    document.getElementById('ManualdoublesideWithBlanks').addEventListener('click', async () => {
      const combinedPdfDoc = await PDFLib.PDFDocument.create();

      const A4_WIDTH = 595.28;
      const A4_HEIGHT = 841.89;

      for (const fileObj of fileListPdf) {
        const file = fileObj.file;

        if (file.type === 'application/pdf') {
          const pdfBytes = await file.arrayBuffer();
          const existingPdf = await PDFLib.PDFDocument.load(pdfBytes);
          let pageCount = existingPdf.getPageCount();

          // Copy all pages into combined PDF
          const copiedPages = await combinedPdfDoc.copyPages(existingPdf, existingPdf.getPageIndices());
          copiedPages.forEach(page => combinedPdfDoc.addPage(page));

          // If page count is odd, add a blank page
          if (pageCount % 2 === 1) {
            combinedPdfDoc.addPage([A4_WIDTH, A4_HEIGHT]);
          }
        }
      }

      // After all PDFs combined and blank pages added:
      const totalPages = combinedPdfDoc.getPageCount();
      const pageIndices = [...Array(totalPages).keys()]; // [0, 1, 2, ..., totalPages - 1]

      const oddIndices = pageIndices.filter(i => i % 2 === 0);
      const evenIndices = pageIndices.filter(i => i % 2 === 1).reverse();

      // Create separate docs for odd and even
      const oddPdfDoc = await PDFLib.PDFDocument.create();
      const evenPdfDoc = await PDFLib.PDFDocument.create();

      const copiedOddPages = await oddPdfDoc.copyPages(combinedPdfDoc, oddIndices);
      copiedOddPages.forEach(page => oddPdfDoc.addPage(page));

      const copiedEvenPages = await evenPdfDoc.copyPages(combinedPdfDoc, evenIndices);
      copiedEvenPages.forEach(page => evenPdfDoc.addPage(page));

      // Download odd pages
      if (oddPdfDoc.getPageCount() > 0) {
        const oddBytes = await oddPdfDoc.save();
        const oddBlob = new Blob([oddBytes], { type: 'application/pdf' });
        const oddLink = document.createElement('a');
        oddLink.href = URL.createObjectURL(oddBlob);
        oddLink.download = 'odd_pages_with_blanks.pdf';
        oddLink.click();
      }

      // Download even pages
      if (evenPdfDoc.getPageCount() > 0) {
        const evenBytes = await evenPdfDoc.save();
        const evenBlob = new Blob([evenBytes], { type: 'application/pdf' });
        const evenLink = document.createElement('a');
        evenLink.href = URL.createObjectURL(evenBlob);
        evenLink.download = 'even_pages_reversed.pdf';
        evenLink.click();
      }
    });


    document.getElementById('ManualBookletWithBlanks').addEventListener('click', async () => {
      const A4_WIDTH = 595.28;
      const A4_HEIGHT = 841.89;

      const combinedPdfDoc = await PDFLib.PDFDocument.create();

      // 1. Combine all PDFs and add blank page if needed
      for (const fileObj of fileListPdf) {
        const file = fileObj.file;
        if (file.type === 'application/pdf') {
          const pdfBytes = await file.arrayBuffer();
          const loadedPdf = await PDFLib.PDFDocument.load(pdfBytes);
          const copiedPages = await combinedPdfDoc.copyPages(loadedPdf, loadedPdf.getPageIndices());
          copiedPages.forEach(p => combinedPdfDoc.addPage(p));

          // Add blank page if original PDF has odd number of pages
          if (loadedPdf.getPageCount() % 2 === 1) {
            combinedPdfDoc.addPage();
          }
        }
      }

      // 2. Pad to multiple of 4
      while (combinedPdfDoc.getPageCount() % 4 !== 0) {
        combinedPdfDoc.addPage();
      }

      const totalPages = combinedPdfDoc.getPageCount();
      const pageOrder = [];

      // 3. Build booklet page order: [last, first], [second, second-last], ...
      let left = 0;
      let right = totalPages - 1;

      while (left < right) {
        pageOrder.push([right, left]);   // front of sheet
        left++;
        right--;

        if (left < right) {
          pageOrder.push([left, right]); // back of sheet
          left++;
          right--;
        }
      }

      // 4. Create final booklet PDF
      const bookletPdf = await PDFLib.PDFDocument.create();

      for (const pair of pageOrder) {
        const [index1, index2] = pair;

        if (
          index1 >= 0 && index1 < totalPages &&
          index2 >= 0 && index2 < totalPages &&
          index1 !== index2
        ) {
          const copied = await bookletPdf.copyPages(combinedPdfDoc, [index1, index2]);
          const [page1, page2] = copied;

          const sheet = bookletPdf.addPage([A4_HEIGHT, A4_WIDTH]); // A4 Landscape

          // Left: page1
          sheet.drawPage(page1, {
            x: 0,
            y: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT,
          });

          // Right: page2
          sheet.drawPage(page2, {
            x: A4_WIDTH,
            y: 0,
            width: A4_WIDTH,
            height: A4_HEIGHT,
          });
        }
      }

      // 5. Download the final booklet
      const finalBytes = await bookletPdf.save();
      const blob = new Blob([finalBytes], { type: 'application/pdf' });
      const link = document.createElement('a');
      link.href = URL.createObjectURL(blob);
      link.download = 'booklet.pdf';
      link.click();
    });


    document.querySelector('#centercontent').addEventListener("click", function () {
      const parent = document.querySelector('#array table');

      // Toggle between empty and "0 auto"
      if (parent.style.margin === "") {
        parent.style.margin = "0 auto"; // center horizontally    
      } else {
        parent.style.margin = ""; // reset to default
      }

      document.querySelector('#array table').style.borderSpacing = "0px";
    });

    document.querySelector('#togglesvg').addEventListener("click", function () {
      const parent = document.querySelector('#svg-container');

      // Toggle between empty and "0 auto"
      if (parent.style.display === "none") {
        parent.style.display = "block"; // center horizontally    
      } else {
        parent.style.display = "none"; // reset to default
      }
    });

    document.querySelector('#displayblock').addEventListener("click", function () {
      document.querySelectorAll('#array table td').forEach(function (e) {
        if (e.style.display === "") {
          e.style.display = "block";
        } else {
          e.style.display = "";
        }
      });
    });


    async function generatePortraitPDF() {
      const { PDFDocument } = PDFLib;

      const pdfDoc = await PDFDocument.create();

      const pageWidth = 595;  // A4 Portrait width (points)
      const pageHeight = 842; // A4 Portrait height (points)

      const cols = 2;
      const rows = 4;
      const imagesPerPage = cols * rows;

      const cellWidth = pageWidth / cols;
      const cellHeight = pageHeight / rows;
      const padding = 10;

      //const images = Array.from(document.querySelectorAll("img"));

      let images = Array.from(document.querySelectorAll('.selected'));

      if (images.length === 0) {
        images = Array.from(document.querySelectorAll('img'));
      }

      images.forEach(img => {
        img.classList.remove('selected');
        img.style.outline = '';
      });

      for (let i = 0; i < images.length; i += imagesPerPage) {
        const page = pdfDoc.addPage([pageWidth, pageHeight]);
        const chunk = images.slice(i, i + imagesPerPage);

        for (let j = 0; j < chunk.length; j++) {
          const img = chunk[j];
          const base64 = img.src;

          const imgBytes = await fetch(base64).then(res => res.arrayBuffer());

          const embeddedImg = base64.startsWith("data:image/png")
            ? await pdfDoc.embedPng(imgBytes)
            : await pdfDoc.embedJpg(imgBytes);

          // Scale image to fit within the cell with padding
          const scale = Math.min(
            (cellWidth - padding * 2) / embeddedImg.width,
            (cellHeight - padding * 2) / embeddedImg.height
          );

          const drawWidth = embeddedImg.width * scale;
          const drawHeight = embeddedImg.height * scale;

          const col = j % cols;
          const row = Math.floor(j / cols);

          const x = col * cellWidth + (cellWidth - drawWidth) / 2;
          const y = pageHeight - ((row + 1) * cellHeight) + (cellHeight - drawHeight) / 2;

          page.drawImage(embeddedImg, {
            x,
            y,
            width: drawWidth,
            height: drawHeight,
          });
        }
      }

      const pdfBytes = await pdfDoc.save();
      const blob = new Blob([pdfBytes], { type: 'application/pdf' });
      const url = URL.createObjectURL(blob);

      const a = document.createElement("a");
      a.href = url;
      a.download = "portrait_id_cards.pdf";
      a.click();
    }

    document.getElementById('openBillLink').addEventListener('click', function (e) {
      e.preventDefault(); // Prevent normal <a> behavior

      let refno = document.getElementById('refno').value.trim();

      if (!refno) {
        alert('Please enter a reference number.');
        return;
      }

      // Append '0' if refno is exactly 13 digits
      if (/^\d{13}$/.test(refno)) {
        refno += '0';
      }

      // Create a form dynamically
      const form = document.createElement('form');
      form.method = 'POST';
      form.action = `https://bill.pitc.com.pk/gbill.aspx?refno=${encodeURIComponent(refno)}`;
      form.target = '_blank'; // Open in a new tab

      // Add to body and submit
      document.body.appendChild(form);
      form.submit();

      // Clean up
      document.body.removeChild(form);
    });

    document.getElementById('openLink').addEventListener('click', function (e) {
      e.preventDefault(); // Prevent normal <a> behavior

      let refno = document.getElementById('refno').value.trim();
      window.open(refno, '_blank'); // Opens in a new tab
      });
    
    function gradientShadowRemovalWithGuidedFilter(canvas = document.querySelector("canvas")) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("2D context not available.");
        return;
      }

      const width = canvas.width;
      const height = canvas.height;
      const imageData = ctx.getImageData(0, 0, width, height);
      const data = imageData.data;

      // Convert RGB imageData to grayscale luminance (0..1)
      function rgbToGray(data) {
        const gray = new Float32Array(data.length / 4);
        for (let i = 0; i < gray.length; i++) {
          const r = data[i * 4];
          const g = data[i * 4 + 1];
          const b = data[i * 4 + 2];
          // luminance with Rec.709 weights
          gray[i] = (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
        }
        return gray;
      }

      // Box filter using integral image for fast mean computation
      function boxFilter(img, w, h, r) {
        const result = new Float32Array(img.length);
        const integral = new Float32Array((w + 1) * (h + 1));

        for (let y = 0; y <= h; y++) {
          for (let x = 0; x <= w; x++) {
            const idx = y * (w + 1) + x;
            if (x === 0 || y === 0) {
              integral[idx] = 0;
            } else {
              integral[idx] =
                img[(y - 1) * w + (x - 1)] +
                integral[idx - 1] +
                integral[idx - (w + 1)] -
                integral[idx - (w + 2)];
            }
          }
        }

        for (let y = 0; y < h; y++) {
          for (let x = 0; x < w; x++) {
            const x1 = Math.max(x - r, 0);
            const x2 = Math.min(x + r, w - 1);
            const y1 = Math.max(y - r, 0);
            const y2 = Math.min(y + r, h - 1);

            const count = (x2 - x1 + 1) * (y2 - y1 + 1);

            const A = integral[y1 * (w + 1) + x1];
            const B = integral[y1 * (w + 1) + (x2 + 1)];
            const C = integral[(y2 + 1) * (w + 1) + x1];
            const D = integral[(y2 + 1) * (w + 1) + (x2 + 1)];

            result[y * w + x] = (D - B - C + A) / count;
          }
        }

        return result;
      }

      // Guided filter for grayscale image
      function guidedFilter(I, p, w, h, r, eps) {
        const N = boxFilter(new Float32Array(w * h).fill(1), w, h, r);

        const mean_I = boxFilter(I, w, h, r);
        const mean_p = boxFilter(p, w, h, r);

        const mean_Ip = boxFilter(
          Float32Array.from(I.map((v, i) => v * p[i])),
          w,
          h,
          r
        );

        const cov_Ip = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          cov_Ip[i] = mean_Ip[i] - mean_I[i] * mean_p[i];
        }

        const mean_II = boxFilter(Float32Array.from(I.map((v) => v * v)), w, h, r);

        const var_I = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          var_I[i] = mean_II[i] - mean_I[i] * mean_I[i];
        }

        const a = new Float32Array(w * h);
        const b = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          a[i] = cov_Ip[i] / (var_I[i] + eps);
          b[i] = mean_p[i] - a[i] * mean_I[i];
        }

        const mean_a = boxFilter(a, w, h, r);
        const mean_b = boxFilter(b, w, h, r);

        const q = new Float32Array(w * h);
        for (let i = 0; i < w * h; i++) {
          q[i] = mean_a[i] * I[i] + mean_b[i];
        }

        return q;
      }

      // Apply illumination correction: multiply original color channels by 1 / illumination
      function applyIlluminationCorrection(data, illumination) {
        const corrected = new Uint8ClampedArray(data.length);
        for (let i = 0; i < illumination.length; i++) {
          const I = illumination[i];
          const eps = 1e-4;
          const ratio = I > eps ? Math.min(1.0 / I, 5) : 1.0;

          corrected[i * 4] = Math.min(data[i * 4] * ratio, 255);
          corrected[i * 4 + 1] = Math.min(data[i * 4 + 1] * ratio, 255);
          corrected[i * 4 + 2] = Math.min(data[i * 4 + 2] * ratio, 255);
          corrected[i * 4 + 3] = data[i * 4 + 3];
        }
        return corrected;
      }

      // Main process:
      // 1. Grayscale conversion for illumination estimation
      const gray = rgbToGray(data);

      // 2. Guided filter parameters: radius & epsilon — adjust as needed
      const radius = 15;
      const epsilon = 0.01;

      // 3. Estimate illumination with guided filter (self-guided)
      const illumination = guidedFilter(gray, gray, width, height, radius, epsilon);

      // 4. Apply illumination correction for shadow removal
      const corrected = applyIlluminationCorrection(data, illumination);

      // 5. Write back corrected pixels to canvas
      for (let i = 0; i < data.length; i++) {
        data[i] = corrected[i];
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function intelligentEdgeAwareThresholding(radius = 1.0, baseBlockSize = 15, C = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data);
      const blurred = gaussianBlur(original, width, height, radius); // You must implement or import this

      const pixelCount = width * height;
      const gray = new Float32Array(pixelCount);
      const grayBlur = new Float32Array(pixelCount);
      const edgeMagnitude = new Float32Array(pixelCount);

      // Convert to grayscale & compute high-pass edges
      for (let i = 0; i < pixelCount; i++) {
        const r1 = original[i * 4], g1 = original[i * 4 + 1], b1 = original[i * 4 + 2];
        const r2 = blurred[i * 4], g2 = blurred[i * 4 + 1], b2 = blurred[i * 4 + 2];

        const gray1 = 0.299 * r1 + 0.587 * g1 + 0.114 * b1;
        const gray2 = 0.299 * r2 + 0.587 * g2 + 0.114 * b2;

        gray[i] = gray1;
        grayBlur[i] = gray2;
        edgeMagnitude[i] = Math.abs(gray1 - gray2); // simple high-pass
      }

      // Normalize edgeMagnitude to [0, 1]
      const maxEdge = edgeMagnitude.reduce((max, val) => Math.max(max, val), -Infinity) || 1e-5;
      for (let i = 0; i < pixelCount; i++) {
        edgeMagnitude[i] /= maxEdge;
      }

      // Build integral image of grayscale
      const integral = new Float32Array(pixelCount);
      for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          rowSum += gray[idx];
          integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
        }
      }

      // Helper to get sum from integral image
      function getRegionSum(x0, y0, x1, y1) {
        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(width - 1, x1);
        y1 = Math.min(height - 1, y1);

        const A = (y0 > 0 && x0 > 0) ? integral[(y0 - 1) * width + (x0 - 1)] : 0;
        const B = (y0 > 0) ? integral[(y0 - 1) * width + x1] : 0;
        const C = (x0 > 0) ? integral[y1 * width + (x0 - 1)] : 0;
        const D = integral[y1 * width + x1];

        return D - B - C + A;
      }

      // Apply adaptive thresholding with edge-aware scaling
      const minBlockSize = 5;
      const maxBlockSize = baseBlockSize;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const edgeStrength = edgeMagnitude[idx];

          // Interpolate block size: strong edge → small block; weak edge → large block
          const effectiveBlockSize = Math.round(
            maxBlockSize - edgeStrength * (maxBlockSize - minBlockSize)
          );

          const halfBlock = Math.floor(effectiveBlockSize / 2);
          const x0 = x - halfBlock;
          const y0 = y - halfBlock;
          const x1 = x + halfBlock;
          const y1 = y + halfBlock;

          const regionWidth = x1 - x0 + 1;
          const regionHeight = y1 - y0 + 1;
          const count = regionWidth * regionHeight;

          const regionSum = getRegionSum(x0, y0, x1, y1);
          const localMean = regionSum / count;

          const threshold = localMean - C;
          const value = gray[idx] >= threshold ? 255 : 0;

          const offset = idx * 4;
          imageData.data[offset] = imageData.data[offset + 1] = imageData.data[offset + 2] = value;
          imageData.data[offset + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function edgeAwareAdaptiveThresholdingSobel(baseBlockSize = 15, C = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data);
      const pixelCount = width * height;

      const gray = new Float32Array(pixelCount);
      const edgeMagnitude = new Float32Array(pixelCount);

      // Convert to grayscale
      for (let i = 0; i < pixelCount; i++) {
        const r = original[i * 4];
        const g = original[i * 4 + 1];
        const b = original[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      // Compute Sobel edge magnitude
      function getPixel(x, y) {
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        return gray[y * width + x];
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gx =
            -1 * getPixel(x - 1, y - 1) + 1 * getPixel(x + 1, y - 1) +
            -2 * getPixel(x - 1, y) + 2 * getPixel(x + 1, y) +
            -1 * getPixel(x - 1, y + 1) + 1 * getPixel(x + 1, y + 1);

          const gy =
            -1 * getPixel(x - 1, y - 1) + -2 * getPixel(x, y - 1) + -1 * getPixel(x + 1, y - 1) +
            1 * getPixel(x - 1, y + 1) + 2 * getPixel(x, y + 1) + 1 * getPixel(x + 1, y + 1);

          const magnitude = Math.sqrt(gx * gx + gy * gy);
          edgeMagnitude[y * width + x] = magnitude;
        }
      }

      // Normalize edgeMagnitude to [0, 1]
      const maxEdge = edgeMagnitude.reduce((max, val) => Math.max(max, val), -Infinity) || 1e-5;
      for (let i = 0; i < pixelCount; i++) {
        edgeMagnitude[i] /= maxEdge;
      }

      // Build integral image of grayscale for fast mean calculation
      const integral = new Float32Array(pixelCount);
      for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          rowSum += gray[idx];
          integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
        }
      }

      function getRegionSum(x0, y0, x1, y1) {
        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(width - 1, x1);
        y1 = Math.min(height - 1, y1);

        const A = (y0 > 0 && x0 > 0) ? integral[(y0 - 1) * width + (x0 - 1)] : 0;
        const B = (y0 > 0) ? integral[(y0 - 1) * width + x1] : 0;
        const C = (x0 > 0) ? integral[y1 * width + (x0 - 1)] : 0;
        const D = integral[y1 * width + x1];

        return D - B - C + A;
      }

      // Apply edge-aware adaptive thresholding
      const minBlockSize = 5;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const edgeStrength = edgeMagnitude[idx];

          // Stronger edge = smaller block size
          const effectiveBlockSize = Math.round(
            baseBlockSize - edgeStrength * (baseBlockSize - minBlockSize)
          );
          const halfBlock = Math.floor(effectiveBlockSize / 2);

          const x0 = x - halfBlock;
          const y0 = y - halfBlock;
          const x1 = x + halfBlock;
          const y1 = y + halfBlock;

          const regionWidth = x1 - x0 + 1;
          const regionHeight = y1 - y0 + 1;
          const count = regionWidth * regionHeight;

          const regionSum = getRegionSum(x0, y0, x1, y1);
          const localMean = regionSum / count;

          const threshold = localMean - C;
          const value = gray[idx] >= threshold ? 255 : 0;

          const offset = idx * 4;
          imageData.data[offset + 0] = value;
          imageData.data[offset + 1] = value;
          imageData.data[offset + 2] = value;
          imageData.data[offset + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function edgeAwareAdaptiveThresholdingColorPreserved(baseBlockSize = 15, C = 10) {
      const canvas = document.querySelector("canvas");
      const ctx = canvas.getContext("2d");
      const width = canvas.width;
      const height = canvas.height;

      const imageData = ctx.getImageData(0, 0, width, height);
      const original = new Uint8ClampedArray(imageData.data);
      const pixelCount = width * height;

      const gray = new Float32Array(pixelCount);
      const edgeMagnitude = new Float32Array(pixelCount);

      // Convert to grayscale
      for (let i = 0; i < pixelCount; i++) {
        const r = original[i * 4];
        const g = original[i * 4 + 1];
        const b = original[i * 4 + 2];
        gray[i] = 0.299 * r + 0.587 * g + 0.114 * b;
      }

      // Compute Sobel edge magnitude
      function getPixel(x, y) {
        x = Math.max(0, Math.min(width - 1, x));
        y = Math.max(0, Math.min(height - 1, y));
        return gray[y * width + x];
      }

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gx =
            -1 * getPixel(x - 1, y - 1) + 1 * getPixel(x + 1, y - 1) +
            -2 * getPixel(x - 1, y) + 2 * getPixel(x + 1, y) +
            -1 * getPixel(x - 1, y + 1) + 1 * getPixel(x + 1, y + 1);

          const gy =
            -1 * getPixel(x - 1, y - 1) + -2 * getPixel(x, y - 1) + -1 * getPixel(x + 1, y - 1) +
            1 * getPixel(x - 1, y + 1) + 2 * getPixel(x, y + 1) + 1 * getPixel(x + 1, y + 1);

          const magnitude = Math.sqrt(gx * gx + gy * gy);
          edgeMagnitude[y * width + x] = magnitude;
        }
      }

      // Normalize edgeMagnitude to [0, 1]
      const maxEdge = edgeMagnitude.reduce((max, val) => Math.max(max, val), -Infinity) || 1e-5;
      for (let i = 0; i < pixelCount; i++) {
        edgeMagnitude[i] /= maxEdge;
      }

      // Build integral image of grayscale
      const integral = new Float32Array(pixelCount);
      for (let y = 0; y < height; y++) {
        let rowSum = 0;
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          rowSum += gray[idx];
          integral[idx] = rowSum + (y > 0 ? integral[(y - 1) * width + x] : 0);
        }
      }

      function getRegionSum(x0, y0, x1, y1) {
        x0 = Math.max(0, x0);
        y0 = Math.max(0, y0);
        x1 = Math.min(width - 1, x1);
        y1 = Math.min(height - 1, y1);

        const A = (y0 > 0 && x0 > 0) ? integral[(y0 - 1) * width + (x0 - 1)] : 0;
        const B = (y0 > 0) ? integral[(y0 - 1) * width + x1] : 0;
        const C = (x0 > 0) ? integral[y1 * width + (x0 - 1)] : 0;
        const D = integral[y1 * width + x1];

        return D - B - C + A;
      }

      // Apply adaptive thresholding, preserving color
      const minBlockSize = 5;

      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = y * width + x;
          const edgeStrength = edgeMagnitude[idx];

          // Smaller window for sharper edges
          const effectiveBlockSize = Math.round(
            baseBlockSize - edgeStrength * (baseBlockSize - minBlockSize)
          );
          const halfBlock = Math.floor(effectiveBlockSize / 2);

          const x0 = x - halfBlock;
          const y0 = y - halfBlock;
          const x1 = x + halfBlock;
          const y1 = y + halfBlock;

          const regionWidth = x1 - x0 + 1;
          const regionHeight = y1 - y0 + 1;
          const count = regionWidth * regionHeight;

          const regionSum = getRegionSum(x0, y0, x1, y1);
          const localMean = regionSum / count;

          const threshold = localMean - C;
          const pixelGray = gray[idx];

          const offset = idx * 4;

          if (pixelGray >= threshold) {
            // Keep original color
            imageData.data[offset + 0] = original[offset + 0];
            imageData.data[offset + 1] = original[offset + 1];
            imageData.data[offset + 2] = original[offset + 2];
          } else {
            // Dim / mask color (or set to white/black)
            const dimFactor = 0.3;
            imageData.data[offset + 0] = original[offset + 0] * dimFactor;
            imageData.data[offset + 1] = original[offset + 1] * dimFactor;
            imageData.data[offset + 2] = original[offset + 2] * dimFactor;
          }

          imageData.data[offset + 3] = 255;
        }
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function autoTrimWhiteSpace(canvas = document.querySelector("canvas"), tolerance = 245, alphaThreshold = 10, minClusterSize = 50) {
  if (!canvas) {
    console.error("Canvas element not found.");
    return;
  }

  const ctx = canvas.getContext("2d");
  const { width, height } = canvas;
  const imageData = ctx.getImageData(0, 0, width, height);
  const data = imageData.data;

  // Step 1: Create binary mask of "non-white" pixels
  const mask = new Uint8Array(width * height);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      const r = data[i], g = data[i + 1], b = data[i + 2], a = data[i + 3];
      const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
      mask[y * width + x] = (a > alphaThreshold && brightness < tolerance) ? 1 : 0;
    }
  }

  // Step 2: Connected-component analysis (flood-fill)
  const visited = new Uint8Array(width * height);
  const clusters = [];

  function floodFill(sx, sy) {
    const stack = [[sx, sy]];
    const cluster = [];
    while (stack.length) {
      const [x, y] = stack.pop();
      const idx = y * width + x;
      if (visited[idx] || mask[idx] === 0) continue;
      visited[idx] = 1;
      cluster.push([x, y]);
      // Check neighbors
      for (let dy = -1; dy <= 1; dy++) {
        for (let dx = -1; dx <= 1; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
            const nidx = ny * width + nx;
            if (!visited[nidx] && mask[nidx]) stack.push([nx, ny]);
          }
        }
      }
    }
    return cluster;
  }

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x;
      if (mask[idx] && !visited[idx]) {
        const cluster = floodFill(x, y);
        if (cluster.length >= minClusterSize) clusters.push(cluster);
      }
    }
  }

  if (!clusters.length) {
    console.warn("No significant non-white content found.");
    return;
  }

  // Step 3: Find bounding box of all clusters combined
  let top = height, bottom = 0, left = width, right = 0;
  clusters.forEach(cluster => {
    cluster.forEach(([x, y]) => {
      top = Math.min(top, y);
      bottom = Math.max(bottom, y);
      left = Math.min(left, x);
      right = Math.max(right, x);
    });
  });

  const trimmedWidth = right - left + 1;
  const trimmedHeight = bottom - top + 1;

  // Step 4: Trim using a temporary canvas
  const tempCanvas = document.createElement("canvas");
  const tempCtx = tempCanvas.getContext("2d");

  const current = images[currentImageIndex];
  tempCanvas.width = current.img.width;
  tempCanvas.height = current.img.height;
  tempCtx.drawImage(current.img, 0, 0);

  const trimmedData = tempCtx.getImageData(left, top, trimmedWidth, trimmedHeight);
  tempCanvas.width = trimmedWidth;
  tempCanvas.height = trimmedHeight;
  tempCtx.putImageData(trimmedData, 0, 0);

  const newImg = new Image();
  newImg.src = tempCanvas.toDataURL();
  newImg.onload = () => {
    images[currentImageIndex] = new ImageObject(newImg);
    loadCurrentImage();
  };
}


    function autoTrimblackSpace(canvas = document.querySelector("canvas")) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }

      const ctx = canvas.getContext("2d");
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      let top = null, bottom = null, left = null, right = null;

      for (let y = 0; y < canvas.height; y++) {
        for (let x = 0; x < canvas.width; x++) {
          const index = (y * canvas.width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const a = data[index + 3];

          // Consider pixel "non-white" if it's not almost pure white (tolerance: 250+)
          if (!(r < 5 && g < 5 && b < 5 && a > 0)) {
            if (top === null || y < top) top = y;
            if (bottom === null || y > bottom) bottom = y;
            if (left === null || x < left) left = x;
            if (right === null || x > right) right = x;
          }
        }
      }

      if (top === null) {
        console.warn("No non-white content found. Skipping trim.");
        return;
      }

      const trimmedWidth = right - left + 1;
      const trimmedHeight = bottom - top + 1;

      const trimmedData = ctx.getImageData(left, top, trimmedWidth, trimmedHeight);

      // Resize canvas and draw the trimmed image
      //canvas.width = trimmedWidth;
      //canvas.height = trimmedHeight;
      //ctx.putImageData(trimmedData, 0, 0);

      // Step 1: Create a temporary canvas element in memory (not shown in the DOM)
      const tempcanvas = document.createElement('canvas');
      const tempctx = tempcanvas.getContext('2d');

      // Step 2: Get the current image
      const current = images[currentImageIndex];

      // Step 3: Set the tempcanvas size to match the image
      tempcanvas.width = current.img.width;
      tempcanvas.height = current.img.height;

      // Step 4: Draw the image onto the temporary canvas
      tempctx.drawImage(current.img, 0, 0);

      const trimmedDatatemp = tempctx.getImageData(left, top, trimmedWidth, trimmedHeight);

      tempcanvas.width = trimmedWidth;
      tempcanvas.height = trimmedHeight;
      tempctx.putImageData(trimmedDatatemp, 0, 0);


      // Create new image object with rotated image and updated points
      const newImg = new Image();
      newImg.src = tempcanvas.toDataURL();
      newImg.onload = () => {
        images[currentImageIndex] = new ImageObject(newImg);

        // pointsDrawn = true;  // Don’t auto-show the points
        loadCurrentImage();
      };
    }

    document.querySelector('#heightresize').addEventListener("click", function () {

      document.querySelectorAll("img").forEach(function (e) {
        e.style.height = "285mm";
        e.style.paddingTop = "0.1in";
      });

    })
    /*
    function contrastStretchingWithHistogramClipping(canvas = document.querySelector("canvas"), clipPercent = 1) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }
    
      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("2D context not available.");
        return;
      }
    
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;
      const totalPixels = data.length / 4;
    
      // Helper to get sorted intensities for a given channel index (0: R, 1: G, 2: B)
      function getSortedChannelData(channelIndex) {
        const channelData = [];
        for (let i = channelIndex; i < data.length; i += 4) {
          channelData.push(data[i]);
        }
        channelData.sort((a, b) => a - b);
        return channelData;
      }
    
      // Calculate clipping bounds based on clipPercent for each channel
      function getClipBounds(sortedData) {
        const clipCount = Math.floor((clipPercent / 100) * sortedData.length);
        const lowBound = sortedData[clipCount];
        const highBound = sortedData[sortedData.length - 1 - clipCount];
        return { lowBound, highBound };
      }
    
      const rSorted = getSortedChannelData(0);
      const gSorted = getSortedChannelData(1);
      const bSorted = getSortedChannelData(2);
    
      const rBounds = getClipBounds(rSorted);
      const gBounds = getClipBounds(gSorted);
      const bBounds = getClipBounds(bSorted);
    
      // Stretch each channel using clipped min/max values
      function stretchValue(value, minVal, maxVal) {
        if (value <= minVal) return 0;
        if (value >= maxVal) return 255;
        return Math.round(((value - minVal) * 255) / (maxVal - minVal));
      }
    
      for (let i = 0; i < data.length; i += 4) {
        data[i] = stretchValue(data[i], rBounds.lowBound, rBounds.highBound);
        data[i + 1] = stretchValue(data[i + 1], gBounds.lowBound, gBounds.highBound);
        data[i + 2] = stretchValue(data[i + 2], bBounds.lowBound, bBounds.highBound);
        // Alpha remains unchanged
      }
    
      ctx.putImageData(imageData, 0, 0);
    }
      */

    function googletranslate() {
      const text = document.querySelector('#output').innerText.trim();
      if (text) {
        const encodedText = encodeURIComponent(text);
        const url = `https://translate.google.com/?hl=en&sl=ur&tl=en&text=${encodedText}&op=translate`;
        window.open(url, '_blank'); // Opens in a new tab
      } else {
        const url = `https://translate.google.com/?hl=en&sl=ur&tl=en`;
        window.open(url, '_blank'); // Opens in a new tab
      }
    }
    function svgeditBtn() {
      // 1. Find the existing contenteditable element
const outputElement = document.getElementById('output');

if (outputElement) {
    // 2. Dynamically create and insert the preview container right after #output
    const previewContainer = document.createElement('div');
    previewContainer.id = 'preview-container';
    
    // Styling it so it's clearly separated (Adjust as needed for your UI)
    previewContainer.style.marginTop = '20px';
    previewContainer.style.padding = '15px';
    previewContainer.style.border = '2px dashed #ccc';
    previewContainer.style.minHeight = '100px';
    
    outputElement.parentNode.insertBefore(previewContainer, outputElement.nextSibling);

    // 3. The cleaning and rendering function
    const updatePreview = () => {
        // Using .innerText automatically strips away the browser's structural <div> and <br> elements 
        // generated by contenteditable, leaving you with just the raw code string.
        let cleanedCode = outputElement.innerText.trim();

        // Inject the cleaned code directly into the preview container to render it
        previewContainer.innerHTML = cleanedCode;
    };

    // 4. Listen for typing, pasting, and deleting inside the editor
    outputElement.addEventListener('input', updatePreview);

    // Run once on load just in case there is pre-existing content
    updatePreview();
}
    }

    document.getElementById('removetag').addEventListener("click", function () {
      document.querySelector('#svg-container').style.display = "block";

      document.querySelectorAll("[x='524']").forEach(e => e.parentElement.remove());
      document.querySelectorAll("[width='225px']").forEach(e => e.remove());

      document.querySelectorAll('h4').forEach(el => {
        if (el.textContent.trim() === 'Page 2') {
          if (el.nextElementSibling) {
            el.nextElementSibling.remove(); // remove sibling first
          }
          el.remove(); // then remove the <h4>
        }
      });

      document.querySelectorAll("[font-size='45px']").forEach(function (e) {
        e.remove();
      });

      generatefidaPDF();

      document.querySelectorAll("svg")[document.querySelectorAll("svg").length - 1].parentElement.style.height = "";
      document.querySelectorAll("svg")[document.querySelectorAll("svg").length - 1].removeAttribute("height");
      document.querySelectorAll("svg")[document.querySelectorAll("svg").length - 1].setAttribute("viewBox", "0 0 1190 1650");
    });

    document.querySelector("#pdfpagetocanvas").addEventListener("click", async function () {

  const loadPromises = fileListPdf.map(async (item) => {
    const file = item.file;

    if (file.type === "application/pdf") {
      const pdfBytes = await file.arrayBuffer();
      const pdfDoc = await pdfjsLib.getDocument({ data: pdfBytes }).promise;
      const pageImages = [];

      for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
        const page = await pdfDoc.getPage(pageNum);

        // 1. Keep scale at 2 for crisp text rendering on the canvas
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement("canvas");
        const context = canvas.getContext("2d");

        canvas.width = viewport.width;
        canvas.height = viewport.height;

        await page.render({ canvasContext: context, viewport }).promise;

        const img = new Image();
        
        // 2. CHANGE HERE: Use image/jpeg (or image/webp) and set quality to 0.85
        // This keeps text sharp but aggressively drops the file size.
        img.src = canvas.toDataURL("image/jpeg", 0.85); 
        
        await new Promise(res => (img.onload = res));

        pageImages.push(new ImageObject(img, file));
      }

      return pageImages;
    }

    return [];
  });

  const nestedImages = await Promise.all(loadPromises);
  images = nestedImages.flat();

  currentImageIndex = 0;
  pointsDrawn = false;

  updateImageSelector();
  loadCurrentImage();

  const svgContainer = document.querySelector("#svg-container");
  if (svgContainer) {
    svgContainer.style.display = "none";
  }
});
    
document.querySelector("#pdfpageassvg").addEventListener("click", async function () {

  const loadPromises = fileListPdf.map(async (item) => {
    const file = item.file;

    if (file.type === "application/pdf") {

      await processPdf(file, useTextOverlay = true);
    }

  });
  setTimeout(editablesvg, 2000);

});

    function showTab(tabId) {
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      document.getElementById(tabId).classList.add('active');

      document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
      const clickedTab = Array.from(document.querySelectorAll('.tab')).find(tab => tab.onclick.toString().includes(tabId));
      if (clickedTab) clickedTab.classList.add('active');
    }

    document.addEventListener("DOMContentLoaded", () => {
      showTab('imageProcessing');
    });

    const scrollContainer = document.getElementById('tabsScroll');
    let isDown = false, startX, scrollLeft;

    scrollContainer.addEventListener('mousedown', (e) => {
      isDown = true;
      startX = e.pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
    });

    scrollContainer.addEventListener('mouseleave', () => isDown = false);
    scrollContainer.addEventListener('mouseup', () => isDown = false);
    scrollContainer.addEventListener('mousemove', (e) => {
      if (!isDown) return;
      e.preventDefault();
      const x = e.pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollContainer.scrollLeft = scrollLeft - walk;
    });

    scrollContainer.addEventListener('touchstart', (e) => {
      isDown = true;
      startX = e.touches[0].pageX - scrollContainer.offsetLeft;
      scrollLeft = scrollContainer.scrollLeft;
    });

    scrollContainer.addEventListener('touchmove', (e) => {
      if (!isDown) return;
      const x = e.touches[0].pageX - scrollContainer.offsetLeft;
      const walk = (x - startX) * 1.5;
      scrollContainer.scrollLeft = scrollLeft - walk;
    });

    scrollContainer.addEventListener('touchend', () => isDown = false);


    document.querySelector("#fourpic").addEventListener("click", function () {
      document.querySelectorAll("td:nth-child(odd)").forEach(function (e) {
        const img = e.querySelector("img"); // Select the <img> inside the <td>
        if (img) {
          img.remove(); // Remove the <img> if it exists
        }
      });
    })

    document.querySelector("#centrefour").addEventListener("click", function () {
      const table = document.querySelector("table");
      table.style.margin = "0 auto";
      table.style.position = "relative"; // Reset position to its default (static)
      table.style.right = "";    // Remove right offset
    });

    document.querySelector("#blue").addEventListener("click", function () {
      document.querySelectorAll("td img:not(#coat)").forEach(function (e) {
        /*e.style.background = "#0084ff";*/
        e.style.background = "deepskyblue";
      });
      document.querySelectorAll("img").forEach(function (e) {
        /*e.style.background = "#0084ff";*/
        e.style.background = "deepskyblue";
      });
    });

    document.querySelector("#border").addEventListener("click", function () {
      document.querySelectorAll("td img:not(#coat)").forEach(function (e) {
        e.style.border = "1px solid black";
      })
      document.querySelectorAll("img").forEach(function (e) {
        /*e.style.background = "#0084ff";*/
        e.style.border = "1px solid black";
      });
    });

    
    if (document.querySelector("#coat")) {
      document.querySelector("#coat").src = global.coat
    }

    
    if (document.querySelector("#coat1")) {
      document.querySelector("#coat1").src = global.coat1
    }

    document.querySelector('#coatapply').addEventListener("click", function () {
      document.querySelectorAll("td").forEach(function (e) {
        e.style = "position: relative;overflow:hidden;";
        e.innerHTML += '<img id="coat" src=' + coat1 + ' style="position: absolute; ">';
      })
    });

    document.querySelector('#svg').addEventListener("click", function () {
      document.querySelectorAll("td").forEach(function (e) {
        e.innerHTML += `<svg width="500" height="500" id="svgCanvas" style="position: absolute;left: 0;">
    <path fill="deepskyblue" d="M0,90 0,180 135,180 135,100 100,100 90,101 C74,120 95,117 49,134 L46,101 L43,100 Z"
    id="path" stroke="transparent"></path></svg>`;
      })
    });

    document.querySelector('#svgpathedit').addEventListener("click", function () {
      const svg = document.getElementById('svgCanvas');
      const path = document.getElementById('path');
      /*
          // Define the path structure
          const pathStructure = [
              { type: 'M', points: [[100, 100]] },
              { type: 'C', points: [[150, 50], [250, 50], [300, 100]] },
              { type: 'L', points: [[100, 215]] },
              { type: 'L', points: [[300, 215]] },
              { type: 'Z', points: [] }
          ];
      */

      // Define the path structure
      const pathStructure = [
        { type: 'M', points: [[8, 114]] },
        { type: 'L', points: [[8, 170]] },
        { type: 'L', points: [[130, 170]] },
        { type: 'L', points: [[130, 122]] },
        { type: 'L', points: [[116, 104]] },
        { type: 'L', points: [[104, 102]] },
        { type: 'C', points: [[100, 140], [55, 134], [56, 102]] },
        { type: 'L', points: [[43, 109]] },
        { type: 'Z', points: [] }
      ];

      const points = [];

      // Dynamically create draggable circles from pathStructure
      pathStructure.forEach(segment => {
        segment.points.forEach(([x, y], index) => {
          const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
          circle.setAttribute('cx', x);
          circle.setAttribute('cy', y);
          circle.setAttribute('r', 2);
          circle.setAttribute('fill', 'red');
          circle.setAttribute('fill-opacity', 0.5);
          circle.classList.add('draggable');
          svg.appendChild(circle);
          points.push(circle);
        });
      });

      function updatePath() {
        let d = '';
        let pointIndex = 0;

        pathStructure.forEach(segment => {
          d += segment.type;
          if (segment.points.length > 0) {
            const coords = segment.points.map(() => {
              const pt = points[pointIndex++];
              return `${pt.cx.baseVal.value},${pt.cy.baseVal.value}`;
            }).join(' ');
            d += coords + ' ';
          }
        });

        //path.setAttribute('d', d.trim());
        document.querySelectorAll('#path').forEach(function (path) {
          path.setAttribute('d', d.trim());
        });
      }

      function startDrag(evt, point) {
        evt.preventDefault();
        const drag = (evt) => {
          const pt = svg.createSVGPoint();
          pt.x = evt.clientX;
          pt.y = evt.clientY;
          const cursor = pt.matrixTransform(svg.getScreenCTM().inverse());

          point.setAttribute('cx', cursor.x);
          point.setAttribute('cy', cursor.y);
          updatePath();
        };

        const endDrag = () => {
          window.removeEventListener('mousemove', drag);
          window.removeEventListener('mouseup', endDrag);
        };

        window.addEventListener('mousemove', drag);
        window.addEventListener('mouseup', endDrag);
      }

      // Add event listeners
      points.forEach(point => {
        point.addEventListener('mousedown', evt => startDrag(evt, point));
      });

      updatePath();
    });

    document.querySelector("#circletoggle").addEventListener("click", function () {
      document.querySelectorAll('#svgCanvas circle').forEach(function (e) {
        const currentDisplay = e.getAttribute("display");
        e.setAttribute("display", currentDisplay === "none" ? "block" : "none");
      });
    });

    document.querySelector('#bringcoat').addEventListener("click", function () {
      document.querySelectorAll('#coat').forEach(function (e) {
        e.style.zIndex = "1";
      });
    });

    function contrastStretchingWithHistogramClipping(
      canvas = document.querySelector("canvas"),
      clipPercent = 1,
      clipMode = "both" // "both", "low", or "high"
    ) {
      if (!canvas) {
        console.error("Canvas element not found.");
        return;
      }

      const ctx = canvas.getContext("2d");
      if (!ctx) {
        console.error("2D context not available.");
        return;
      }

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const data = imageData.data;

      // Helper to get sorted intensities for a given channel index (0: R, 1: G, 2: B)
      function getSortedChannelData(channelIndex) {
        const channelData = [];
        for (let i = channelIndex; i < data.length; i += 4) {
          channelData.push(data[i]);
        }
        channelData.sort((a, b) => a - b);
        return channelData;
      }

      // Calculate clipping bounds based on clipPercent and clipMode
      function getClipBounds(sortedData) {
        const length = sortedData.length;
        const clipCount = Math.floor((clipPercent / 100) * length);

        let lowBound = sortedData[0];
        let highBound = sortedData[length - 1];

        if (clipMode === "low" || clipMode === "both") {
          lowBound = sortedData[clipCount];
        }

        if (clipMode === "high" || clipMode === "both") {
          highBound = sortedData[length - 1 - clipCount];
        }

        // Prevent divide-by-zero
        if (highBound === lowBound) {
          highBound = lowBound + 1;
        }

        return { lowBound, highBound };
      }


      const rSorted = getSortedChannelData(0);
      const gSorted = getSortedChannelData(1);
      const bSorted = getSortedChannelData(2);

      const rBounds = getClipBounds(rSorted);
      const gBounds = getClipBounds(gSorted);
      const bBounds = getClipBounds(bSorted);

      // Stretch each channel using clipped min/max values
      function stretchValue(value, minVal, maxVal) {
        if (value <= minVal) return 0;
        if (value >= maxVal) return 255;
        return Math.round(((value - minVal) * 255) / (maxVal - minVal));
      }

      for (let i = 0; i < data.length; i += 4) {
        data[i] = stretchValue(data[i], rBounds.lowBound, rBounds.highBound);
        data[i + 1] = stretchValue(data[i + 1], gBounds.lowBound, gBounds.highBound);
        data[i + 2] = stretchValue(data[i + 2], bBounds.lowBound, bBounds.highBound);
        // Alpha channel remains unchanged
      }

      ctx.putImageData(imageData, 0, 0);
    }

    function callAHK() {
      fetch('http://localhost:8080/run?cmd=openNotepad')
        .then(res => console.log("Command sent to AHK"))
        .catch(err => console.error(err));
    }

    document.querySelector("#sixpics").addEventListener("click", function () {
      const img = document.querySelector("img");
      img.style.height = "45mm";
      img.style.width = "35mm";

      const tds = document.querySelectorAll("td");

      if (img) {
        for (let i = 1; i <= 6 && i < tds.length; i++) {
          tds[i-1].append(img.cloneNode(true));
        }
        // Delete all other <td> elements except those with index 1 to 5
        tds.forEach((td, index) => {
          if (index > 5) {
            td.parentElement.remove();
            td.remove();
          }
        });
      }

      //document.querySelector("table").style.paddingLeft = "2.8in";
      document.querySelector("table").style.borderSpacing = "12px 12px";
      document.querySelector("table").style.margin = "0 auto";
      document.querySelector("table").style.paddingRight = "0.85in";
      document.querySelector("table").style.marginTop = "0.05in";

      document.querySelector(".tab-content.active").style.display = "none";
      window.print();
      document.querySelector(".tab-content.active").style = "";
    });
    document.querySelector("#fivepics").addEventListener("click", function () {
  const img = document.querySelector("img");
  if (!img) return;

  img.style.height = "45mm";
  img.style.width = "35mm";

  const table = document.querySelector("table");

  // Clear existing table content
  table.innerHTML = "";

  // Create a new row
  const tr = document.createElement("tr");

  // Create 5 columns
  for (let i = 0; i < 5; i++) {
    const td = document.createElement("td");
    td.appendChild(img.cloneNode(true));
    tr.appendChild(td);
  }

  table.appendChild(tr);

  // Styling
  table.style.borderSpacing = "15px 15px";
  table.style.margin = "0 auto";
  table.style.marginTop = "0.05in";

  document.querySelector(".tab-content.active").style.display = "none";
});

    document.querySelector("#eightpics").addEventListener("click", async function () {
      await rotateCurrentImage();
      const img = document.querySelector("img");
      img.style.height = "35mm";
      img.style.width = "45mm";      

      const tds = document.querySelectorAll("td");

      if (img) {
        for (let i = 1; i <= 8 && i < tds.length; i++) {
          tds[i-1].append(img.cloneNode(true));
        }
        // Delete all other <td> elements except those with index 1 to 5
        tds.forEach((td, index) => {
          if (index > 7) {
            td.parentElement.remove();
            td.remove();
          }
        });
      }

      //document.querySelector("table").style.paddingLeft = "2.8in";
      document.querySelector("table").style.borderSpacing = "7px";
      document.querySelector("table").style.margin = "0 auto";
      //document.querySelector("table").style.paddingRight = "0.65in";
      document.querySelector("table").style.marginTop = "0.05in";

      document.querySelector(".tab-content.active").style.display = "none";

    });
    document.querySelector("#fourpics").addEventListener("click", function () {
  const img = document.querySelector("img");
  if (!img) return;

  img.style.height = "35mm";
  img.style.width = "45mm";

  const table = document.querySelector("table");
  const tds = Array.from(table.querySelectorAll("td"));

  table.innerHTML = ""; // Clear existing table

  const columns = 4;
  let row;

  tds.slice(0, 8).forEach((_, index) => {
    if (index % columns === 0) {
      row = table.insertRow();
    }
    const cell = row.insertCell();
    cell.appendChild(img.cloneNode(true));
  });

  // Table styling
  table.style.borderSpacing = "7px";
  table.style.margin = "0 auto";
  table.style.marginTop = "0.05in";

  document.querySelector(".tab-content.active").style.display = "none";
});


    let zoomLevel = 1; // initial zoom

    function zoomIn() {
      zoomLevel += 0.1;         // increase zoom
      document.body.style.zoom = zoomLevel;
    }

    function zoomOut() {
      zoomLevel -= 0.1;         // decrease zoom
      if (zoomLevel < 0.1) zoomLevel = 0.1; // minimum zoom
      document.body.style.zoom = zoomLevel;
    }

    function resetZoom() {
      zoomLevel = 1;
      document.body.style.zoom = zoomLevel;
    }

    /*
    let zoomLevel = 1;
    const zoomcanvas = document.querySelector('canvas');
    const zoomctx = zoomcanvas.getContext('2d');
    
    // Example drawing function
    function zoom() {
        zoomctx.clearRect(0, 0, zoomcanvas.width, zoomcanvas.height);
        zoomctx.save();
        zoomctx.scale(zoomLevel, zoomLevel); // scale canvas content
        zoomctx.fillStyle = 'red';
        zoomctx.fillRect(50, 50, 100, 100); // example rectangle
        zoomctx.restore();
    }
    
    // Zoom functions
    function zoomIn() {
        zoomLevel += 0.1;
        zoom();
    }
    
    function zoomOut() {
        zoomLevel -= 0.1;
        if (zoomLevel < 0.1) zoomLevel = 0.1;
        zoom();
    }
    
    // Initial draw
    zoom();
    
      function resetZoom() {
        zoomLevel = 1;
        document.body.style.zoom = zoomLevel;
      }
    
        let finalTranscript = ''; // Store confirmed speech
    
      function startVoiceTyping() {
        const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SpeechRecognition) {
          alert("Speech Recognition not supported in this browser.");
          return;
        }
    
        const recognition = new SpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        recognition.lang = 'en-US';
    
        recognition.onresult = function(event) {
          let interimTranscript = '';
    
          for (let i = event.resultIndex; i < event.results.length; ++i) {
            const result = event.results[i];
            if (result.isFinal) {
              finalTranscript += result[0].transcript + ' ';
            } else {
              interimTranscript += result[0].transcript;
            }
          }
    
          document.getElementById('output').innerText = finalTranscript + interimTranscript;
        };
    
        recognition.onerror = function(event) {
          console.error("Speech recognition error", event);
        };
    
        recognition.start();
      }
    */

    let finalTranscript = ''; // Store confirmed speech
    let recognition;

    function startVoiceTyping(langCode) {
      const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        alert("Speech Recognition not supported in this browser.");
        return;
      }

      if (recognition) {
        recognition.stop();
      }

      recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = langCode;

      const inputElem = document.querySelector('#textInput');
      const outputElem = document.getElementById('output');

      // Sync manual edits to finalTranscript
      outputElem.addEventListener('input', () => {
        finalTranscript = outputElem.innerText;
        inputElem.innerText = finalTranscript;
      });

      recognition.onresult = function (event) {
        let interimTranscript = '';
        for (let i = event.resultIndex; i < event.results.length; ++i) {
          const result = event.results[i];
          if (result.isFinal) {
            finalTranscript += result[0].transcript + ' ';
          } else {
            interimTranscript += result[0].transcript;
          }
        }

        // Update both input and output
        const combinedText = finalTranscript + interimTranscript;
        inputElem.value = combinedText;
        outputElem.innerText = combinedText;
      };

      recognition.onerror = function (event) {
        console.error("Speech recognition error", event);
      };

      recognition.onend = function () {
        console.log("Speech recognition stopped.");
      };

      recognition.start();
      console.log("Listening in:", langCode);
    }

    function setupRotationSlider() {
  const canvas = document.querySelector("canvas");
  const ctx = canvas.getContext("2d");
  const slider = document.getElementById("rotationSlider");

  const current = images[currentImageIndex];
  const img = current.img;

  function drawRotatedImage(degrees) {
    const radians = degrees * Math.PI / 180;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const scale = Math.min(
      canvas.width / img.width,
      canvas.height / img.height
    );

    const drawWidth = img.width * scale;
    const drawHeight = img.height * scale;

    ctx.save();

    ctx.translate(canvas.width / 2, canvas.height / 2);
    ctx.rotate(radians);

    ctx.drawImage(
      img,
      -drawWidth / 2,
      -drawHeight / 2,
      drawWidth,
      drawHeight
    );

    ctx.restore();
  }

  slider.addEventListener("input", (e) => {
    const angle = parseFloat(e.target.value);
    drawRotatedImage(angle);
  });
}

    document.querySelector('#urduStyle').addEventListener("click", function (e) {
      document.querySelector('#output').contentEditable = true;
      document.querySelector('#output').style.textAlign = "right";
      document.querySelector('#output').dir = "rtl";
      document.querySelector('#output').style.fontFamily = "Jameel Noori Nastaleeq";
    })

    async function ocrwarp() {
      const current = images[currentImageIndex];
      const [tl, tr, br, bl] = current.points;

      const width = Math.floor(Math.max(distance(tl, tr), distance(bl, br)));
      const height = Math.floor(Math.max(distance(tl, bl), distance(tr, br)));

      const destCanvas = document.createElement("canvas");
      destCanvas.width = width;
      destCanvas.height = height;
      const destCtx = destCanvas.getContext("2d");
      const destImageData = destCtx.createImageData(width, height);

      // Compute homography from dest → src
      const H = computeHomography(
        [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height },
        ],
        [tl, tr, br, bl]
      );

      const src = current.imageData.data;
      const srcW = canvas.width;
      const srcH = canvas.height;

      // Warp each pixel
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const denom = H[6] * x + H[7] * y + H[8];
          const sx = (H[0] * x + H[1] * y + H[2]) / denom;
          const sy = (H[3] * x + H[4] * y + H[5]) / denom;

          const sxi = Math.floor(sx);
          const syi = Math.floor(sy);

          if (sxi < 0 || syi < 0 || sxi >= srcW || syi >= srcH) continue;

          const srcIdx = (syi * srcW + sxi) * 4;
          const destIdx = (y * width + x) * 4;

          for (let i = 0; i < 4; i++) {
            destImageData.data[destIdx + i] = src[srcIdx + i];
          }
        }
      }

      destCtx.putImageData(destImageData, 0, 0);

      const result = await Tesseract.recognize(
  destCanvas.toDataURL(),
  'eng',
  {
    logger: m => console.log(m),
    tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
  }
);

const lines = result.data.text.split('\n').filter(l => l.trim() !== '');

const html = lines.map(line => `<div>${line}</div>`).join('');
/* let html = '';

 result.data.lines.forEach(line => {
   const { x0, y0, x1, y1 } = line.bbox;

   html += `
     <div style="position:absolute; left:${x0}px; top:${y0}px;">
       ${line.text}
     </div>
   `;
 });*/
document.querySelector('#output').innerHTML += html;
      
        current.hiddenPoints = current.points; // Temporarily store current points
        current.points = []; // Clear points
        pointsDrawn = false;
draw(); // Redraw the canvas
await navigator.clipboard.writeText(result.data.text);
    }

    document.querySelector("#ocrrequired").addEventListener("click", async function () {
      const outputDiv = document.querySelector('#output');
      const result = await Tesseract.recognize(document.querySelector("#canvas"), 'eng', {
        logger: m => console.log(m),
        tessedit_pageseg_mode: Tesseract.PSM.SPARSE_TEXT,
      });

      const words = result.data.words || [];
      const fullText = result.data.text.trim() || 'No text detected.';
      outputDiv.innerHTML = '';

      const lines = fullText.split('\n');
      lines.forEach(line => {
        if (line.includes('|')) {
          const table = document.createElement('table');
          const row = document.createElement('tr');
          line.split('|').map(cell => cell.trim()).filter(Boolean).forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell;
            row.appendChild(td);
          });
          table.appendChild(row);
          outputDiv.appendChild(table);
        } else if (line.trim()) {
          const p = document.createElement('p');
          p.textContent = line.trim();
          outputDiv.appendChild(p);
        }
      });

      parsePassportMRZ();
    })

    function textup(){

    document.addEventListener("mouseup", () => {
  const selectedText = window.getSelection().toString().trim();

  if (!selectedText) return;

  if (navigator.clipboard && navigator.clipboard.writeText) {
    navigator.clipboard.writeText(selectedText)
      .then(() => console.log("Copied to clipboard:", selectedText))
      .catch(err => console.error("Clipboard write failed:", err));
  } else {
    // fallback for older browsers
    fallbackCopy(selectedText);
  }
});

// Fallback function
function fallbackCopy(text) {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";  // avoid scroll jump
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  try {
    const successful = document.execCommand("copy");
    console.log("Fallback copy success:", successful);
  } catch (err) {
    console.error("Fallback copy failed:", err);
  }
  document.body.removeChild(textarea);
}

    }

function tabling() {
  const output = document.getElementById("output");
  if (!output) return;

  const divs = Array.from(output.children).filter(
    el => el.tagName === "DIV"
  );

  if (!divs.length) return;

  const table = document.createElement("table");
  table.style.width = "100%";
  table.border = "1";

  const fragment = document.createDocumentFragment();

  for (const div of divs) {
    const text = div.textContent?.trim();
    if (!text) continue;

    let columns = [];

    // 1️⃣ If line contains "|" → use it as column separator
    if (text.includes("|")) {
      columns = text
        .split("|")
        .map(col => col.trim())
        .filter(col => col.length > 0);
    }
    // 2️⃣ Otherwise prefer colon
    else if (text.includes(":")) {
      const colonIndex = text.lastIndexOf(":");
      columns = [
        text.slice(0, colonIndex).trim(),
        text.slice(colonIndex + 1).trim()
      ];
    }
    // 3️⃣ Otherwise split on last whitespace
    else {
      const match = text.match(/^(.+?)\s+(\S+)$/);
      if (match) {
        columns = [match[1].trim(), match[2]];
      } else {
        columns = [text];
      }
    }

    const row = document.createElement("tr");

    for (const col of columns) {
      const cell = document.createElement("td");
      cell.textContent = col;
      row.appendChild(cell);
    }

    fragment.appendChild(row);
  }

  table.appendChild(fragment);
  output.replaceChildren(table);
}
function tablingLine() {
  const output = document.getElementById("output");
  if (!output) return;

  // Get all direct child divs of #output
  const divs = Array.from(output.children).filter(el => el.tagName === "DIV");
  if (!divs.length) return;

  const table = document.createElement("table");
  table.style.width = "100%";
  table.border = "1";
  const fragment = document.createDocumentFragment();

  // Loop over divs in pairs
  for (let i = 0; i < divs.length; i += 2) {
    const tr = document.createElement("tr");

    const td1 = document.createElement("td");
    td1.textContent = divs[i].textContent?.trim() || "";
    tr.appendChild(td1);

    const td2 = document.createElement("td");
    // Check if there is a next div for the second column
    td2.textContent = divs[i + 1]?.textContent?.trim() || "";
    tr.appendChild(td2);

    fragment.appendChild(tr);
  }

  table.appendChild(fragment);

  // Replace old content with the table
  output.innerHTML = "";
  output.appendChild(table);
}

function removeText() {

  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height);
  const data = imgData.data;
  const width = canvas.width;
  const height = canvas.height;

  const threshold = 160;
  const brightnessMask = new Float32Array(width * height);
  const combinedMask = new Float32Array(width * height);

  // Brightness mask (soft)
  for (let i = 0; i < data.length; i += 4) {
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
    const confidence = brightness < threshold ? (1 - brightness / threshold) : 0;
    brightnessMask[i / 4] = confidence;
  }

  // Edge detection mask (binary)
  const edgeMask = applyEdgeDetection(data, width, height);

  // Combine masks
  for (let i = 0; i < combinedMask.length; i++) {
    combinedMask[i] = Math.max(brightnessMask[i], edgeMask[i] * 0.9);
  }

  // Inpainting passes
  const passes = 15;
  for (let pass = 0; pass < passes; pass++) {
    const newData = new Uint8ClampedArray(data);

    for (let y = 2; y < height - 2; y++) {
      for (let x = 2; x < width - 2; x++) {
        const idx = y * width + x;
        if (combinedMask[idx] > 0.01) {
          const color = getWeightedSurroundingAverageColor(data, x, y, width, height, combinedMask);
          if (color) {
            const i = idx * 4;
            newData[i] = color.r;
            newData[i + 1] = color.g;
            newData[i + 2] = color.b;
            newData[i + 3] = 255;
            combinedMask[idx] *= 0.5; // gradually reduce mask weight
          }
        }
      }
    }

    data.set(newData);
  }

  ctx.putImageData(imgData, 0, 0);
}


function applyEdgeDetection(data, width, height) {
  const grayscale = new Float32Array(width * height);
  const edgeMask = new Uint8Array(width * height);

  // Convert to grayscale
  for (let i = 0; i < data.length; i += 4) {
    const idx = i / 4;
    const r = data[i];
    const g = data[i + 1];
    const b = data[i + 2];
    grayscale[idx] = 0.299 * r + 0.587 * g + 0.114 * b;
  }

  // Sobel kernels
  const gx = [-1, 0, 1, -2, 0, 2, -1, 0, 1];
  const gy = [-1, -2, -1, 0, 0, 0, 1, 2, 1];

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      let dx = 0, dy = 0;

      for (let ky = -1; ky <= 1; ky++) {
        for (let kx = -1; kx <= 1; kx++) {
          const px = x + kx;
          const py = y + ky;
          const weightX = gx[(ky + 1) * 3 + (kx + 1)];
          const weightY = gy[(ky + 1) * 3 + (kx + 1)];
          const val = grayscale[py * width + px];

          dx += val * weightX;
          dy += val * weightY;
        }
      }

      const magnitude = Math.sqrt(dx * dx + dy * dy);
      const idx = y * width + x;
      edgeMask[idx] = magnitude > 80 ? 1 : 0; // You can tweak this threshold
    }
  }

  return edgeMask;
}


function getWeightedSurroundingAverageColor(data, x, y, width, height, mask) {
  let totalR = 0, totalG = 0, totalB = 0, totalWeight = 0;

  const radius = 2;
  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      const nx = x + dx;
      const ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;

      const idx = ny * width + nx;
      if (mask[idx] < 0.01) {
        const i = idx * 4;
        const dist = Math.sqrt(dx * dx + dy * dy) || 1;
        const weight = 1 / dist;

        totalR += data[i] * weight;
        totalG += data[i + 1] * weight;
        totalB += data[i + 2] * weight;
        totalWeight += weight;
      }
    }
  }

  if (totalWeight === 0) return null;

  return {
    r: totalR / totalWeight,
    g: totalG / totalWeight,
    b: totalB / totalWeight
  };
}



    function getSurroundingAverageColor(data, x, y, width, height, mask) {
  const neighbors = [];
  const offsets = [-1, 0, 1];

  for (let dx of offsets) {
    for (let dy of offsets) {
      if (dx === 0 && dy === 0) continue;
      const nx = x + dx;
      const ny = y + dy;
      if (nx >= 0 && nx < width && ny >= 0 && ny < height) {
        const idx = ny * width + nx;
        if (mask[idx] === 0) {
          const i = idx * 4;
          const r = data[i];
          const g = data[i + 1];
          const b = data[i + 2];
          neighbors.push({ r, g, b });
        }
      }
    }
  }

  if (neighbors.length === 0) return null;

  const avg = neighbors.reduce((acc, c) => {
    acc.r += c.r;
    acc.g += c.g;
    acc.b += c.b;
    return acc;
  }, { r: 0, g: 0, b: 0 });

  return {
    r: avg.r / neighbors.length,
    g: avg.g / neighbors.length,
    b: avg.b / neighbors.length
  };
}

function domicilecheck() {
    // Get the innerText of #output and remove extra whitespace
    let text = document.getElementById("output").innerText.trim();

    // Regex to find CNIC anywhere: 00000-0000000-0 OR 13 consecutive digits
    const cnicPattern = /\b(\d{5}-\d{7}-\d{1}|\d{13})\b/;

    // Check if CNIC exists in the text
    const match = text.match(cnicPattern);

    if (match) {
        let id = match[0]; // Extract the matched CNIC

        // If it's 13 digits without dashes, convert to dashed format
        if (/^\d{13}$/.test(id)) {
            id = id.slice(0,5) + '-' + id.slice(5,12) + '-' + id.slice(12);
        }

        // Construct the URL
        const url = "https://domicile.punjab.gov.pk/AjaxCall.aspx?ID=" + encodeURIComponent(id);

        // Open the URL in a new tab
        window.open(url, "_blank");
    } else {
        alert("No valid CNIC found in the text.");
    }
}

function getCaretCharacterOffsetWithin(element) {
    let caretOffset = 0;
    const sel = window.getSelection();
    if (sel.rangeCount > 0) {
        const range = sel.getRangeAt(0);
        const preCaretRange = range.cloneRange();
        preCaretRange.selectNodeContents(element);
        preCaretRange.setEnd(range.endContainer, range.endOffset);
        caretOffset = preCaretRange.toString().length;
    }
    return caretOffset;
}

function setCaretPosition(element, offset) {
    const range = document.createRange();
    const sel = window.getSelection();
    let currentOffset = 0;

    function walk(node) {
        if (node.nodeType === 3) { // text node
            const nextOffset = currentOffset + node.length;
            if (offset <= nextOffset) {
                range.setStart(node, offset - currentOffset);
                range.collapse(true);
                sel.removeAllRanges();
                sel.addRange(range);
                throw "done";
            }
            currentOffset = nextOffset;
        } else {
            for (let i = 0; i < node.childNodes.length; i++) {
                walk(node.childNodes[i]);
            }
        }
    }

    try { walk(element); } catch(e) {}
}

function moveLineUp() {
    const editor = document.getElementById("output");
    const sel = window.getSelection();

    if (!sel.rangeCount) return;
    const range = sel.getRangeAt(0);
    let line = range.startContainer;

    // Find the parent div line
    while (line && line.parentNode !== editor) {
        line = line.parentNode;
    }
    if (!line) return;

    const prevLine = line.previousElementSibling;
    if (!prevLine) return; // Already first line

    // Swap lines
    editor.insertBefore(line, prevLine);

    // Restore caret to the same relative position
    const newRange = document.createRange();

    // Try to preserve offset within the line
    let offset = range.startOffset;
    if (range.startContainer.nodeType === 3) {
        offset = Math.min(offset, line.textContent.length);
        newRange.setStart(line.firstChild || line, offset);
    } else {
        newRange.setStart(line, 0);
    }

    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
}

function moveLineDown() {
    const editor = document.getElementById("output");
    const text = editor.innerText;
    const caretPos = getCaretCharacterOffsetWithin(editor);

    let lines = text.split("\n");
    let charCount = 0;
    let lineIndex = 0;

    for (let i = 0; i < lines.length; i++) {
        if (caretPos <= charCount + lines[i].length) {
            lineIndex = i;
            break;
        }
        charCount += lines[i].length + 1;
    }

    if (lineIndex < lines.length - 1) {
        [lines[lineIndex + 1], lines[lineIndex]] =
        [lines[lineIndex], lines[lineIndex + 1]];

        editor.innerText = lines.join("\n");

        setCaretPosition(editor, charCount + lines[lineIndex + 1].length + 1);
    }
}
