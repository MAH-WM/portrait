const fileInput = document.getElementById('file-input');
const previewImg = document.getElementById('preview-img');
const nameInput = document.getElementById('name-input');
const titleSelect = document.getElementById('title-select');
const customTitleInput = document.getElementById('custom-title-input');
const finalPreviewCanvas = document.getElementById('final-preview-canvas');
const finalPreviewCtx = finalPreviewCanvas.getContext('2d');
const afterUpload = document.getElementById('after-upload');

// Mål i pixels for 9x13 cm ved 300 dpi
const TARGET_WIDTH = 1063;
const TARGET_HEIGHT = 1535;

let cropper = null;
let lastCroppedDataUrl = null;

function getCurrentTitle() {
  if (titleSelect.value === 'Andet') {
    return customTitleInput.value.trim();
  } else {
    return titleSelect.value;
  }
}

// Vis/skjul custom-title-input
function handleTitleSelectChange() {
  if (titleSelect.value === 'Andet') {
    customTitleInput.style.display = 'block';
  } else {
    customTitleInput.style.display = 'none';
  }
  drawFinalPreview();
}
titleSelect.addEventListener('change', handleTitleSelectChange);
customTitleInput.addEventListener('input', drawFinalPreview);

function drawFinalPreview() {
  if (!cropper) {
    finalPreviewCanvas.style.display = 'none';
    return;
  }
  // Få det beskårne billede som dataURL
  const croppedCanvas = cropper.getCroppedCanvas({
    width: TARGET_WIDTH,
    height: TARGET_HEIGHT,
    imageSmoothingQuality: 'high'
  });
  finalPreviewCtx.clearRect(0, 0, TARGET_WIDTH, TARGET_HEIGHT);
  // Tegn billedet
  finalPreviewCtx.drawImage(croppedCanvas, 0, 0, TARGET_WIDTH, TARGET_HEIGHT);

  // Gradient: nederste 40%
  const gradHeight = Math.floor(TARGET_HEIGHT * 0.4);
  const gradY = TARGET_HEIGHT - gradHeight;
  const gradient = finalPreviewCtx.createLinearGradient(0, gradY, 0, TARGET_HEIGHT);
  gradient.addColorStop(0, 'rgba(0,0,0,0)');
  gradient.addColorStop(1, 'rgba(0,0,0,0.6)');
  finalPreviewCtx.fillStyle = gradient;
  finalPreviewCtx.fillRect(0, gradY, TARGET_WIDTH, gradHeight);

  // Tekst
  const padding = 40;
  const nameFontSize = 70;
  const titleFontSize = 42;
  const name = nameInput.value.trim();
  const title = getCurrentTitle().toUpperCase();
  let y = TARGET_HEIGHT - padding - 60;

  // Titel (Inter/Arial)
  if (title) {
    finalPreviewCtx.font = `600 ${titleFontSize}px 'Inter', Arial, sans-serif`;
    finalPreviewCtx.fillStyle = 'white';
    finalPreviewCtx.textBaseline = 'bottom';
    finalPreviewCtx.fillText(title, padding + 20, y + 10);
    y -= titleFontSize + 10;
  }
  // Navn (Publico)
  if (name) {
    finalPreviewCtx.font = `400 ${nameFontSize}px 'Publico Headline Web', serif`;
    finalPreviewCtx.fillStyle = 'white';
    finalPreviewCtx.textBaseline = 'bottom';
    const maxNameWidth = 900;
    // Bryd navnet til max to linjer
    let lines = [];
    if (finalPreviewCtx.measureText(name).width <= maxNameWidth) {
      lines = [name];
    } else {
      // Prøv at splitte på mellemrum
      const words = name.split(' ');
      let line1 = '';
      let line2 = '';
      for (let i = 0; i < words.length; i++) {
        const testLine = (line1 ? line1 + ' ' : '') + words[i];
        if (finalPreviewCtx.measureText(testLine).width <= maxNameWidth) {
          line1 = testLine;
        } else {
          line2 = words.slice(i).join(' ');
          break;
        }
      }
      lines = [line1, line2];
    }
    // Tegn linjerne, så bunden flugter
    if (lines.length === 2) {
      finalPreviewCtx.fillText(lines[0], padding + 20, y - nameFontSize - 8);
      finalPreviewCtx.fillText(lines[1], padding + 20, y);
    } else {
      finalPreviewCtx.fillText(lines[0], padding + 20, y);
    }
  }

  finalPreviewCanvas.style.display = 'block';
}

fileInput.addEventListener('change', function() {
  const file = this.files[0];
  if (file) {
    // Vis cropper, preview og send-knap
    afterUpload.style.display = 'block';
    const reader = new FileReader();
    reader.onload = function(e) {
      previewImg.src = e.target.result;
      previewImg.style.display = 'block';

      // Initier eller opdater cropper
      if (cropper) {
        cropper.destroy();
      }
      cropper = new Cropper(previewImg, {
        aspectRatio: 9 / 13,
        viewMode: 1,
        autoCropArea: 1,
        movable: true,
        zoomable: true,
        scalable: false,
        rotatable: false,
        responsive: true,
        background: false,
        modal: false,
        crop: function() {
          drawFinalPreview();
        }
      });
      // Første preview
      setTimeout(drawFinalPreview, 200);
    }
    reader.readAsDataURL(file);
  }
});

nameInput.addEventListener('input', drawFinalPreview);

async function sendToOneDrive() {
  if (!cropper) {
    alert("Vælg og beskær et billede først!");
    return;
  }
  
  try {
    // Hent webhook URL fra Vercel API
    const response = await fetch('/api/get-webhook-url');
    const { webhookUrl } = await response.json();
    
    // Brug canvas fra live-preview (med gradient og tekst)
    finalPreviewCanvas.toBlob(function(blob) {
      if (blob.size > 6 * 1024 * 1024) {
        alert("Det færdige billede er for stort. Prøv et mindre billede eller kortere tekst.");
        return;
      }
      // Brug navn som filnavn, rens for ugyldige tegn og tilføj tidspunkt
      let rawName = nameInput.value.trim() || 'billede';
      let safeName = rawName.replace(/[^a-zA-Z0-9æøåÆØÅ _-]/g, '');
      const now = new Date();
      const hh = String(now.getHours()).padStart(2, '0');
      const mm = String(now.getMinutes()).padStart(2, '0');
      const ss = String(now.getSeconds()).padStart(2, '0');
      const dd = String(now.getDate()).padStart(2, '0');
      const MM = String(now.getMonth() + 1).padStart(2, '0');
      const yyyy = now.getFullYear();
      const timeStr = `${hh}${mm}${ss}-${dd}${MM}${yyyy}`;
      const filename = `${safeName} ${timeStr}.jpg`;

      const formData = new FormData();
      formData.append("file", blob, filename);

      fetch(webhookUrl, {
        method: "POST",
        body: formData
      })
      .then(response => {
        if (response.ok) {
          alert("Billedet er beskåret, med tekst og gradient, og sendt til OneDrive!");
        } else {
          alert("Noget gik galt. Prøv igen.");
        }
      })
      .catch(() => {
        alert("Noget gik galt. Prøv igen.");
      });
    }, "image/jpeg", 0.92);
  } catch (error) {
    alert("Kunne ikke hente webhook URL. Prøv igen.");
  }
}

// Skjul cropper, preview og send-knap fra start
window.addEventListener('DOMContentLoaded', function() {
  afterUpload.style.display = 'none';
});
