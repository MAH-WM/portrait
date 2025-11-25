const PRINT_WIDTH = 1063; // ~9 cm at 300 dpi
const PRINT_HEIGHT = 1299; // ~11 cm at 300 dpi
const ASPECT_RATIO = PRINT_WIDTH / PRINT_HEIGHT;
const ZAPIER_WEBHOOK_URL = "https://hooks.zapier.com/hooks/catch/25480364/uzey70l/";

const steps = Array.from(document.querySelectorAll(".step"));
const form = document.getElementById("info-form");
const nameInput = document.getElementById("full-name");
const titleInput = document.getElementById("job-title");
const nameError = document.getElementById("full-name-error");
const titleError = document.getElementById("job-title-error");
const captureBtn = document.getElementById("capture-btn");
const uploadBtn = document.getElementById("upload-btn");
const fileInput = document.getElementById("file-input");
const cropNextBtn = document.getElementById("crop-next");
const cropperImage = document.getElementById("cropper-image");
const previewImg = document.getElementById("preview-image");
const canvas = document.getElementById("output-canvas");
const uploadFinalBtn = document.getElementById("upload-final");
const rawCanvas = document.createElement("canvas");
const rawCtx = rawCanvas.getContext("2d");

let currentStep = 0;
let selectedFile = null;
let cropper = null;
let isDrawing = false;
const forbiddenCharsPattern = /[\\/:*?"<>|]/;

const fontsReady = Promise.all([
  document.fonts.load("85px 'PublicoHeadline-Light'"),
  document.fonts.load("50px 'Montserrat-Bold'")
]).catch((error) => {
  console.error("Font loading failed:", error);
  // Fallback: wait a bit and try again
  return new Promise((resolve) => {
    setTimeout(() => {
      Promise.all([
        document.fonts.load("85px 'PublicoHeadline-Light'"),
        document.fonts.load("50px 'Montserrat-Bold'")
      ]).then(resolve).catch(() => {
        console.warn("Fonts may not be loaded correctly");
        resolve(); // Continue anyway
      });
    }, 500);
  });
});

document.addEventListener("click", (event) => {
  const nav = event.target.closest("[data-nav]");
  if (!nav) return;

  const action = nav.dataset.nav;
  if (action === "back") {
    showStep(Math.max(0, currentStep - 1));
  } else if (action === "start") {
    resetFlow();
  }
});

captureBtn.addEventListener("click", () => {
  // Use capture attribute to hint at camera usage
  fileInput.setAttribute("capture", "environment");
  fileInput.click();
});

uploadBtn.addEventListener("click", () => {
  fileInput.removeAttribute("capture");
  fileInput.click();
});

[nameInput, titleInput].forEach((input) => {
  input.addEventListener("input", () => {
    validateForm();
  });
});

fileInput.addEventListener("change", handleFileChange);
cropNextBtn.addEventListener("click", handleCropConfirm);
uploadFinalBtn.addEventListener("click", handleUpload);
validateForm();

function showStep(index) {
  currentStep = index;
  steps.forEach((section, i) => {
    section.hidden = i !== index;
  });

  if (index !== 1) destroyCropper();
}

function resetFlow() {
  form.reset();
  selectedFile = null;
  previewImg.src = "";
  canvas.hidden = true;
  previewImg.hidden = true;
  rawCanvas.width = 0;
  rawCanvas.height = 0;
  showStep(0);
}

function handleFileChange(evt) {
  const file = evt.target.files?.[0];
  if (!file) return;
  if (!validateForm()) {
    form.reportValidity();
    evt.target.value = "";
    return;
  }
  selectedFile = file;
  loadImageForCrop(file);
}

async function loadImageForCrop(file) {
  const dataUrl = await fileToDataURL(file);
  cropperImage.src = dataUrl;
  cropperImage.onload = () => {
    initCropper();
    showStep(1);
  };
}

function initCropper() {
  destroyCropper();
  cropper = new Cropper(cropperImage, {
    aspectRatio: ASPECT_RATIO,
    viewMode: 1,
    dragMode: "move",
    autoCropArea: 1,
    responsive: true,
    background: false,
    guides: true,
    center: true
  });
}

function destroyCropper() {
  if (cropper) {
    cropper.destroy();
    cropper = null;
  }
}

async function handleCropConfirm() {
  if (!cropper) return;
  const croppedCanvas = cropper.getCroppedCanvas({
    width: PRINT_WIDTH,
    height: PRINT_HEIGHT,
    imageSmoothingEnabled: true,
    imageSmoothingQuality: "high"
  });
  showStep(2);

  // Draw final canvas with overlay
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, PRINT_WIDTH, PRINT_HEIGHT);
  ctx.drawImage(croppedCanvas, 0, 0, PRINT_WIDTH, PRINT_HEIGHT);

  // Draw raw canvas WITHOUT overlay - just the cropped image in double size
  rawCanvas.width = PRINT_WIDTH * 2;
  rawCanvas.height = PRINT_HEIGHT * 2;
  rawCtx.imageSmoothingEnabled = true;
  rawCtx.imageSmoothingQuality = "high";
  rawCtx.clearRect(0, 0, rawCanvas.width, rawCanvas.height);
  // Draw directly from croppedCanvas - NO overlay, NO gradient, NO text
  rawCtx.drawImage(croppedCanvas, 0, 0, rawCanvas.width, rawCanvas.height);

  await fontsReady;
  
  // Double-check that fonts are actually loaded
  const testCtx = document.createElement("canvas").getContext("2d");
  testCtx.font = "85px 'PublicoHeadline-Light'";
  const publicoLoaded = testCtx.measureText("M").width > 0;
  testCtx.font = "50px 'Montserrat-Bold'";
  const montserratLoaded = testCtx.measureText("M").width > 0;
  
  if (!publicoLoaded || !montserratLoaded) {
    console.warn("Fonts may not be fully loaded, waiting additional 500ms...");
    await new Promise(resolve => setTimeout(resolve, 500));
  }
  
  // Only draw overlay on the final canvas, NOT on rawCanvas
  drawOverlay(ctx, nameInput.value.trim(), titleInput.value.trim());
  const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
  previewImg.src = dataUrl;
  previewImg.hidden = false;
}

function drawOverlay(ctx, name, title) {
  // Gradient for readability
  const gradientHeight = 320;
  const gradient = ctx.createLinearGradient(
    0,
    PRINT_HEIGHT - gradientHeight,
    0,
    PRINT_HEIGHT
  );
  gradient.addColorStop(0, "rgba(6, 6, 6, 0)");
  gradient.addColorStop(1, "rgba(6, 6, 6, 0.85)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, PRINT_HEIGHT - gradientHeight, PRINT_WIDTH, gradientHeight);

  const textMarginLeft = 60;
  const textMarginRight = 60;
  const usableWidth = PRINT_WIDTH - textMarginLeft - textMarginRight;
  const bottomMargin = 80;
  const titleGap = 24;

  ctx.fillStyle = "#FFFFFF";
  ctx.textBaseline = "alphabetic";

  const nameFont = "85px 'PublicoHeadline-Light'";
  const titleFont = "50px 'Montserrat-Bold'";
  const nameLineHeight = 80;
  const titleLineHeight = 51;

  const nameLines = wrapText(name, ctx, nameFont, usableWidth, nameLineHeight, 2);
  
  // For title, we need to account for letter-spacing (0.08em) in the width calculation
  const titleLines = wrapTextWithLetterSpacing(
    title.toUpperCase(),
    ctx,
    titleFont,
    usableWidth,
    titleLineHeight,
    0.08,
    2
  );

  const titleBlockHeight = titleLines.length * titleLineHeight;
  const nameBlockHeight = nameLines.length * nameLineHeight;
  const titleStartY = PRINT_HEIGHT - bottomMargin - titleBlockHeight + titleLineHeight;
  const nameStartY =
    titleStartY - titleGap - (nameLines.length > 1 ? nameBlockHeight : nameLineHeight);

  let currentY = nameStartY;
  ctx.font = nameFont;
  nameLines.forEach((line) => {
    ctx.fillText(line, textMarginLeft, currentY);
    currentY += nameLineHeight;
  });

  currentY = titleStartY;
  ctx.font = titleFont;
  titleLines.forEach((line) => {
    drawLetterSpacedText(ctx, line, textMarginLeft, currentY, 0.08);
    currentY += titleLineHeight;
  });
}

function wrapText(text, ctx, font, maxWidth, lineHeight, maxLines = 2) {
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const metrics = ctx.measureText(testLine);
    if (metrics.width > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const lastLine = trimmed[trimmed.length - 1];
    trimmed[trimmed.length - 1] = addEllipsis(ctx, lastLine, maxWidth);
    return trimmed;
  }

  return lines;
}

function measureTextWithLetterSpacing(ctx, text, spacingEm) {
  const spacing = spacingEm * ctx.measureText("M").width;
  let totalWidth = 0;
  for (let i = 0; i < text.length; i++) {
    totalWidth += ctx.measureText(text[i]).width;
    if (i < text.length - 1) {
      totalWidth += spacing;
    }
  }
  return totalWidth;
}

function wrapTextWithLetterSpacing(text, ctx, font, maxWidth, lineHeight, spacingEm, maxLines = 2) {
  ctx.font = font;
  const words = text.split(/\s+/);
  const lines = [];
  let currentLine = "";

  words.forEach((word) => {
    const testLine = currentLine ? `${currentLine} ${word}` : word;
    const testWidth = measureTextWithLetterSpacing(ctx, testLine, spacingEm);
    if (testWidth > maxWidth && currentLine) {
      lines.push(currentLine);
      currentLine = word;
    } else {
      currentLine = testLine;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  if (lines.length > maxLines) {
    const trimmed = lines.slice(0, maxLines);
    const lastLine = trimmed[trimmed.length - 1];
    // For ellipsis, we need to account for letter-spacing too
    let fitted = lastLine;
    while (measureTextWithLetterSpacing(ctx, `${fitted}…`, spacingEm) > maxWidth && fitted.length) {
      fitted = fitted.slice(0, -1);
    }
    trimmed[trimmed.length - 1] = `${fitted}…`;
    return trimmed;
  }

  return lines;
}

function addEllipsis(ctx, line, maxWidth) {
  const ellipsis = "…";
  let fitted = line;
  while (ctx.measureText(`${fitted}${ellipsis}`).width > maxWidth && fitted.length) {
    fitted = fitted.slice(0, -1);
  }
  return `${fitted}${ellipsis}`;
}

function drawLetterSpacedText(ctx, text, x, y, spacingEm = 0.08) {
  const spacing = spacingEm * ctx.measureText("M").width;
  let cursor = x;
  for (const char of text) {
    ctx.fillText(char, cursor, y);
    const charWidth = ctx.measureText(char).width;
    cursor += charWidth + spacing;
  }
}

async function handleUpload() {
  if (!ZAPIER_WEBHOOK_URL) {
    alert("Tilføj Zapier webhook-URL i app.js før upload aktiveres.");
    return;
  }

  if (isDrawing) return;

  if (!rawCanvas.width || !rawCanvas.height) {
    alert("Beskær billedet, før du uploader.");
    return;
  }

  try {
    isDrawing = true;
    uploadFinalBtn.disabled = true;
    uploadFinalBtn.textContent = "Uploader...";

    const [finalBlob, rawBlob] = await Promise.all([
      canvasToBlob(canvas),
      canvasToBlob(rawCanvas)
    ]);

    const formData = new FormData();
    const baseName = nameInput.value.trim() || "medarbejder";
    const safeName = baseName.toLowerCase().replace(/\s+/g, "-");
    formData.append("file", finalBlob, `${safeName}-portrait.jpg`);
    formData.append("rawFile", rawBlob, `${safeName}-portrait-raw.jpg`);
    formData.append("fullName", baseName);
    formData.append("title", titleInput.value.trim());

    const response = await fetch(ZAPIER_WEBHOOK_URL, {
      method: "POST",
      body: formData
    });

    if (!response.ok) throw new Error("Upload mislykkedes");
    uploadFinalBtn.textContent = "Uploadet ✔";
  } catch (error) {
    console.error(error);
    alert("Der opstod en fejl under upload. Prøv igen.");
    uploadFinalBtn.textContent = "Upload til fremkaldelse";
  } finally {
    uploadFinalBtn.disabled = false;
    isDrawing = false;
  }
}

function fileToDataURL(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function canvasToBlob(targetCanvas) {
  return new Promise((resolve, reject) => {
    targetCanvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
        } else {
          reject(new Error("Kunne ikke generere billedfil."));
        }
      },
      "image/jpeg",
      0.92
    );
  });
}

function validateForm() {
  const nameValid = validateTextField(nameInput, nameError);
  const titleValid = validateTextField(titleInput, titleError);
  const formValid = nameValid && titleValid;
  captureBtn.disabled = uploadBtn.disabled = !formValid;
  return formValid;
}

function validateTextField(inputEl, errorEl) {
  const value = inputEl.value;
  let message = "";
  if (!value.trim()) {
    message = "Feltet må ikke være tomt.";
  } else if (forbiddenCharsPattern.test(value)) {
    message = 'Undgå tegnene \\ / : * ? " < > |';
  } else if (/[.\s]$/.test(value)) {
    message = "Må ikke slutte med punktum eller mellemrum.";
  }
  inputEl.setCustomValidity(message);
  errorEl.textContent = message;
  return message === "";
}

