/**
 * Generate PWA icons for Bakit Kita Iboboto
 * Creates PNG icons at all required sizes using sharp.
 * Uses the Philippine flag blue (#0038a8) as theme color.
 */
import sharp from "sharp";
import { mkdirSync } from "fs";

const SIZES = [72, 96, 128, 144, 152, 192, 384, 512];

function generateSvg(size: number): Buffer {
  const fontSize = Math.round(size * 0.28);
  const subFontSize = Math.round(size * 0.14);
  const centerX = size / 2;
  const centerY = size / 2;
  const rx = Math.round(size * 0.18);

  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0047d4"/>
      <stop offset="100%" style="stop-color:#0038a8"/>
    </linearGradient>
  </defs>
  <rect width="${size}" height="${size}" rx="${rx}" fill="url(#bg)"/>
  <text x="${centerX}" y="${centerY - subFontSize * 0.4}" font-family="Arial,Helvetica,sans-serif" font-size="${fontSize}" font-weight="bold" fill="white" text-anchor="middle" dominant-baseline="central">BKIB</text>
  <text x="${centerX}" y="${centerY + fontSize * 0.6}" font-family="Arial,Helvetica,sans-serif" font-size="${subFontSize}" fill="rgba(255,255,255,0.7)" text-anchor="middle" dominant-baseline="central">BOTO MO</text>
</svg>`;

  return Buffer.from(svg);
}

async function main() {
  console.log("=== Generating PWA Icons ===\n");

  mkdirSync("public/icons", { recursive: true });

  for (const size of SIZES) {
    const svgBuffer = generateSvg(size);
    const outputPath = `public/icons/icon-${size}x${size}.png`;

    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(outputPath);

    console.log(`  ✅ ${outputPath} (${size}x${size})`);
  }

  console.log(`\n=== Done: ${SIZES.length} PNG icons generated ===`);
}

main().catch(console.error);
