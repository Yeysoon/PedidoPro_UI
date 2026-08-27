const { Jimp } = require('jimp');
const path = require('path');

async function extractAndGenerateLogos() {
  const inputPath = path.join(__dirname, 'public', 'images', 'PedidosProBlack.jpg');
  const img = await Jimp.read(inputPath);

  const w = img.bitmap.width;
  const h = img.bitmap.height;

  // 1. Find bounding box of green cloche pixels
  let minX = w, maxX = 0, minY = h, maxY = 0;

  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4;
      const r = img.bitmap.data[idx + 0];
      const g = img.bitmap.data[idx + 1];
      const b = img.bitmap.data[idx + 2];

      // Green cloche detection
      if (g > 110 && g > r * 1.15 && g > b * 0.8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }

  console.log('Cloche bounding box:', { minX, maxX, minY, maxY, width: maxX - minX, height: maxY - minY });

  const pad = 24;
  const cropX = Math.max(0, minX - pad);
  const cropY = Math.max(0, minY - pad);
  const cropW = Math.min(w - cropX, (maxX - minX) + pad * 2);
  const cropH = Math.min(h - cropY, (maxY - minY) + pad * 2);

  // 2. Create dark mode logo (vibrant mint on transparent)
  const darkLogo = new Jimp({ width: cropW, height: cropH, color: 0x00000000 });
  // 3. Create light mode logo (deep emerald / contrast on transparent)
  const lightLogo = new Jimp({ width: cropW, height: cropH, color: 0x00000000 });

  for (let y = 0; y < cropH; y++) {
    for (let x = 0; x < cropW; x++) {
      const srcX = cropX + x;
      const srcY = cropY + y;
      const srcIdx = (srcY * w + srcX) * 4;
      const dstIdx = (y * cropW + x) * 4;

      const r = img.bitmap.data[srcIdx + 0];
      const g = img.bitmap.data[srcIdx + 1];
      const b = img.bitmap.data[srcIdx + 2];

      // Calculate green intensity / brightness
      // Cloche color is around RGB(60, 240, 175)
      // Background is around RGB(4, 26, 62)
      const isGreen = (g > 80 && g > r * 1.15);
      const intensity = Math.max(0, Math.min(1, (g - 50) / 150));

      if (isGreen && intensity > 0.1) {
        const alpha = Math.round(intensity * 255);

        // Dark mode: keep vibrant original mint (#34D399 / #4EFEB3)
        darkLogo.bitmap.data[dstIdx + 0] = r;
        darkLogo.bitmap.data[dstIdx + 1] = g;
        darkLogo.bitmap.data[dstIdx + 2] = b;
        darkLogo.bitmap.data[dstIdx + 3] = alpha;

        // Light mode: Deep crisp emerald (#047857) or dark slate teal (#0F172A / #065F46)
        // High contrast for light background
        lightLogo.bitmap.data[dstIdx + 0] = Math.round(r * 0.15 + 4);
        lightLogo.bitmap.data[dstIdx + 1] = Math.round(g * 0.5 + 100);
        lightLogo.bitmap.data[dstIdx + 2] = Math.round(b * 0.35 + 50);
        lightLogo.bitmap.data[dstIdx + 3] = alpha;
      }
    }
  }

  await darkLogo.write(path.join(__dirname, 'public', 'images', 'logo-dark.png'));
  await lightLogo.write(path.join(__dirname, 'public', 'images', 'logo-light.png'));

  console.log('Successfully generated standalone cropped transparent logos: logo-dark.png & logo-light.png');
}

extractAndGenerateLogos().catch(console.error);
