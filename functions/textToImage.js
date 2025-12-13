const { createCanvas, loadImage } = require("canvas");
const path = require("path");

const LOGO_PATH = path.join(__dirname, "noteicon.jpg");

function wrapText(ctx, text, maxWidth) {
  const words = text.split(" ");
  const lines = [];
  let line = "";

  for (let word of words) {
    const testLine = line + word + " ";
    if (ctx.measureText(testLine).width > maxWidth && line !== "") {
      lines.push(line.trim());
      line = word + " ";
    } else {
      line = testLine;
    }
  }

  if (line) lines.push(line.trim());
  return lines;
}

async function textToImageBuffer(text) {
  const WIDTH = 1200;
  const CONTENT_WIDTH = 900;
  const PADDING = 70;
  const FONT_SIZE = 40;
  const LINE_HEIGHT = 56;
  const HEADER_HEIGHT = 140;

  const tempCanvas = createCanvas(WIDTH, 200);
  const tempCtx = tempCanvas.getContext("2d");
  tempCtx.font = `${FONT_SIZE}px Arial`;

  const paragraphs = text.split("\n");
  let lines = [];

  paragraphs.forEach(p => {
    lines.push(...wrapText(tempCtx, p, CONTENT_WIDTH));
    lines.push("");
  });

  const HEIGHT =
    HEADER_HEIGHT + PADDING + lines.length * LINE_HEIGHT + PADDING;

  const canvas = createCanvas(WIDTH, HEIGHT);
  const ctx = canvas.getContext("2d");

  // 🌑 Base background
  ctx.fillStyle = "#0B1220";
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // 🌫️ Background logo watermark
  try {
    const bgLogo = await loadImage(LOGO_PATH);

    const MAX_BG_WIDTH = WIDTH * 0.6;
    const scale = MAX_BG_WIDTH / bgLogo.width;
    const bgW = bgLogo.width * scale;
    const bgH = bgLogo.height * scale;

    ctx.globalAlpha = 0.2; // subtle watermark
    ctx.drawImage(
      bgLogo,
      (WIDTH - bgW) / 2,
      (HEIGHT - bgH) / 2,
      bgW,
      bgH
    );
    ctx.globalAlpha = 1; // reset
  } catch (_) {}

  // Header
  ctx.fillStyle = "#020617";
  ctx.fillRect(0, 0, WIDTH, HEADER_HEIGHT);

  // Foreground logo (top-left)
  try {
    const logo = await loadImage(LOGO_PATH);
    const LOGO_MAX_HEIGHT = 60;
    const scale = LOGO_MAX_HEIGHT / logo.height;
    const logoWidth = logo.width * scale;
    const logoHeight = logo.height * scale;

    ctx.drawImage(
      logo,
      PADDING,
      (HEADER_HEIGHT - logoHeight) / 2,
      logoWidth,
      logoHeight
    );
  } catch (_) {}

  // Divider
  ctx.strokeStyle = "#1E293B";
  ctx.beginPath();
  ctx.moveTo(PADDING, HEADER_HEIGHT);
  ctx.lineTo(WIDTH - PADDING, HEADER_HEIGHT);
  ctx.stroke();

  // ✍️ Text
  ctx.fillStyle = "#E6EDF3";
  ctx.font = `${FONT_SIZE}px Arial`;

  let y = HEADER_HEIGHT + PADDING;
  lines.forEach(line => {
    ctx.fillText(line, PADDING, y);
    y += LINE_HEIGHT;
  });

  return canvas.toBuffer("image/png");
}

module.exports = { textToImageBuffer };
