// 1. Get DOM Elements & Setup Initial Values
const inputEl = document.getElementById("qr-input");
inputEl.value = "";

const fgColorInput = document.getElementById("fg-color");
const bgColorInput = document.getElementById("bg-color");
const logoInput = document.getElementById("logo-input");
const qrSizeInput = document.getElementById("qr-size");
const qrUnitInput = document.getElementById("qr-unit");
const settingsButton = document.getElementById("settings-btn");
const settingsPanel = document.getElementById("settings-panel");

let uploadedLogoSrc = null;
let qrRenderVersion = 0;
let qrUpdateTimeout;

function scheduleQRCodeUpdate() {
    clearTimeout(qrUpdateTimeout);
    qrUpdateTimeout = setTimeout(updateQRCode, 120);
}

function getQrSizeInPixels() {
    const value = Number.parseFloat(qrSizeInput.value);
    const safeValue = Number.isFinite(value) ? Math.max(value, 1) : 160;
    const unit = qrUnitInput ? qrUnitInput.value : "px";
    const pixelsPerUnit = unit === "in" ? 96 : unit === "cm" ? 96 / 2.54 : 1;

    return Math.min(2000, Math.max(1, Math.round(safeValue * pixelsPerUnit)));
}

// 2. Setup Canvas & Snow Effect Background
const canvas = document.getElementById("snowCanvas");
const ctx = canvas.getContext("2d");

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
resizeCanvas();
window.addEventListener("resize", resizeCanvas);

const numFlakes = 50;
const flakes = [];

for (let i = 0; i < numFlakes; i++) {
    flakes.push({
        x: Math.random() * canvas.width,
        y: Math.random() * canvas.height,
        r: Math.random() * 2 + 1,
        d: Math.random() * numFlakes
    });
}

function drawFlakes() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
    
    for (let i = 0; i < numFlakes; i++) {
        const f = flakes[i];
        ctx.beginPath();
        ctx.arc(f.x, f.y, f.r, 0, Math.PI * 2);
        ctx.fill();

        f.y += Math.random() * 1 + 0.5;
        f.x += Math.sin(f.d) * 0.2;

        if (f.y > canvas.height) {
            flakes[i] = { x: Math.random() * canvas.width, y: 0, r: f.r, d: f.d };
        }
    }

    requestAnimationFrame(drawFlakes);
}

drawFlakes();

// 3. Listen for Logo File Selection
logoInput.addEventListener("change", function (e) {
    const file = e.target.files[0];
    const fileNameDisplay = document.getElementById("file-name-display");
    
    if (file) {
        fileNameDisplay.textContent = file.name;
        const reader = new FileReader();
        reader.onload = function (event) {
            uploadedLogoSrc = event.target.result;
            updateQRCode();
        };
        reader.readAsDataURL(file);
    } else {
        fileNameDisplay.textContent = "No file chosen";
        uploadedLogoSrc = null;
        updateQRCode();
    }
});

// 4. Function to Render / Update the QR Code
function updateQRCode() {
    const renderVersion = ++qrRenderVersion;
    const val = inputEl.value;
    const fgColor = fgColorInput.value;
    const bgColor = bgColorInput.value;
    const qrContainer = document.getElementById("qrcode");

    const nextQr = document.createElement("div");
    nextQr.style.position = "absolute";
    nextQr.style.visibility = "hidden";
    nextQr.style.pointerEvents = "none";
    document.body.appendChild(nextQr);

    new QRCode(nextQr, {
        text: val ? val : " ",
        width: 160,
        height: 160,
        colorDark: fgColor,
        colorLight: bgColor,
        correctLevel: QRCode.CorrectLevel.H
    });

    setTimeout(() => {
        if (renderVersion !== qrRenderVersion) {
            nextQr.remove();
            return;
        }

        qrContainer.replaceChildren(...nextQr.childNodes);
        nextQr.remove();

        if (uploadedLogoSrc) {
            const logoImg = document.createElement("img");
            logoImg.src = uploadedLogoSrc;
            logoImg.className = "qr-center-logo";
            qrContainer.appendChild(logoImg);
        }
    }, 50);
}

// Initial render on load
updateQRCode();

// Event Listeners for Input and Colors
inputEl.addEventListener("input", scheduleQRCodeUpdate);
fgColorInput.addEventListener("input", scheduleQRCodeUpdate);
bgColorInput.addEventListener("input", scheduleQRCodeUpdate);

settingsButton.addEventListener("click", function () {
    const isOpen = settingsPanel.hidden;
    settingsPanel.hidden = !isOpen;
    settingsButton.setAttribute("aria-expanded", String(isOpen));
});

function saveQrBlob(blob) {
    const file = new File([blob], "goober-qr.png", { type: "image/png" });

    if (navigator.share && (!navigator.canShare || navigator.canShare({ files: [file] }))) {
        return navigator.share({ files: [file], title: "GooberQR" }).catch(() => {});
    }

    const blobUrl = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = blobUrl;
    link.download = "goober-qr.png";
    link.target = "_blank";
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(() => URL.revokeObjectURL(blobUrl), 1000);
}

// 5. Download Button Logic (Handles both plain QR and Logo Overlay)
document.getElementById("download-btn").addEventListener("click", function () {
    const qrImage = document.querySelector("#qrcode img:not(.qr-center-logo)");
    if (!qrImage) return;

    const qrSize = getQrSizeInPixels();
    const size = qrSize;
    
    const canvasExport = document.createElement("canvas");
    canvasExport.width = size;
    canvasExport.height = size;
    const ctxExport = canvasExport.getContext("2d");
    
    ctxExport.imageSmoothingEnabled = true;
    ctxExport.imageSmoothingQuality = 'high';

    const qrImgObj = new Image();
    qrImgObj.crossOrigin = "anonymous";
    qrImgObj.src = qrImage.src;
    qrImgObj.onload = function () {
        ctxExport.drawImage(qrImgObj, 0, 0, size, size);

        if (!uploadedLogoSrc) {
            canvasExport.toBlob(saveQrBlob, "image/png");
            return;
        }

        const logoObj = new Image();
        logoObj.src = uploadedLogoSrc;
        logoObj.onload = function () {
            const logoSize = qrSize * 0.28125;
            const x = (size - logoSize) / 2;
            const y = (size - logoSize) / 2;
            const padding = 4;

            ctxExport.fillStyle = "#ffffff";
            ctxExport.fillRect(x - padding, y - padding, logoSize + (padding * 2), logoSize + (padding * 2));

            ctxExport.drawImage(logoObj, x, y, logoSize, logoSize);
            canvasExport.toBlob(saveQrBlob, "image/png");
        };
    };
});

const safetyModeCheckbox = document.getElementById('safety-mode');

function updateSafetyMode() {
    const centerLogoImg = document.querySelector('#qrcode img.qr-center-logo');
    if (!centerLogoImg) return;
    
    if (safetyModeCheckbox && safetyModeCheckbox.checked) {
        centerLogoImg.classList.add('safety-on');
    } else {
        centerLogoImg.classList.remove('safety-on');
    }
}