import fs from "fs";
import path from "path";
import { Image, read, write } from "image-js";
import { AppInfo } from "../types.js";

// macOS icon sizes
const ICON_SIZES = [
  { size: 16, scale: 1 },
  { size: 16, scale: 2 },
  { size: 32, scale: 1 },
  { size: 32, scale: 2 },
  { size: 128, scale: 1 },
  { size: 128, scale: 2 },
  { size: 256, scale: 1 },
  { size: 256, scale: 2 },
  { size: 512, scale: 1 },
  { size: 512, scale: 2 },
];

// Apple macOS Big Sur+ icon geometry: artwork occupies 824/1024 of the canvas,
// masked with a squircle. We approximate the squircle as a superellipse with n=5.
const MASK_CANVAS_SIZE = 1024;
const ARTWORK_RATIO = 824 / 1024;
const SQUIRCLE_EXPONENT = 5;

export interface AssetOptions {
  applyAppleMask?: boolean;
}

function compositeCentered(canvas: Image, source: Image): void {
  const offsetX = Math.round((canvas.width - source.width) / 2);
  const offsetY = Math.round((canvas.height - source.height) / 2);
  for (let y = 0; y < source.height; y++) {
    for (let x = 0; x < source.width; x++) {
      const pixel = source.getPixel(x, y);
      if (pixel[3] === 0) continue;
      canvas.setPixel(offsetX + x, offsetY + y, pixel);
    }
  }
}

// Multiply each pixel's alpha by a supersampled squircle coverage mask.
// The squircle matches the artwork bounding box (824/1024 of canvas),
// not the full canvas — Apple's mask is inset, not edge-to-edge.
// Only needs to run once at the largest size; downscaling produces clean
// antialiased edges at smaller sizes.
function applySquircleMask(image: Image, samplesPerAxis = 4): void {
  const size = image.width;
  const center = size / 2;
  const radius = (size * ARTWORK_RATIO) / 2;
  const n = SQUIRCLE_EXPONENT;
  const step = 1 / samplesPerAxis;
  const totalSamples = samplesPerAxis * samplesPerAxis;

  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      let inside = 0;
      for (let sy = 0; sy < samplesPerAxis; sy++) {
        for (let sx = 0; sx < samplesPerAxis; sx++) {
          const px = x + (sx + 0.5) * step;
          const py = y + (sy + 0.5) * step;
          const dx = Math.abs(px - center) / radius;
          const dy = Math.abs(py - center) / radius;
          if (Math.pow(dx, n) + Math.pow(dy, n) <= 1) inside++;
        }
      }
      if (inside === totalSamples) continue;
      const pixel = image.getPixel(x, y);
      pixel[3] = Math.round(pixel[3] * (inside / totalSamples));
      image.setPixel(x, y, pixel);
    }
  }
}

function renderAppleMaskedSource(source: Image): Image {
  const innerSize = Math.round(MASK_CANVAS_SIZE * ARTWORK_RATIO);
  const artwork = source.resize({ width: innerSize, height: innerSize });
  // image-js's new Image() defaults RGBA alpha to 255 (opaque black) — pass an
  // explicit zeroed buffer so the area outside the artwork stays transparent.
  const canvas = new Image(MASK_CANVAS_SIZE, MASK_CANVAS_SIZE, {
    colorModel: "RGBA",
    data: new Uint8Array(MASK_CANVAS_SIZE * MASK_CANVAS_SIZE * 4),
  });
  compositeCentered(canvas, artwork);
  applySquircleMask(canvas);
  return canvas;
}

function generateContentsJson(): string {
  const images = ICON_SIZES.map(({ size, scale }) => ({
    filename: `icon_${size}x${size}${scale > 1 ? `@${scale}x` : ""}.png`,
    idiom: "mac",
    scale: `${scale}x`,
    size: `${size}x${size}`,
  }));

  return JSON.stringify(
    {
      images,
      info: {
        author: "xcode",
        version: 1,
      },
    },
    null,
    2,
  );
}

function findSourceIcon(projectRoot: string): string | null {
  const possiblePaths = [
    path.join(projectRoot, "src-tauri", "icons", "icon.png"),
    path.join(projectRoot, "src-tauri", "icons", "128x128@2x.png"),
    path.join(projectRoot, "src-tauri", "icons", "128x128.png"),
  ];

  for (const iconPath of possiblePaths) {
    if (fs.existsSync(iconPath)) {
      return iconPath;
    }
  }
  return null;
}

export async function generateAssets(
  macosDir: string,
  _appInfo: AppInfo,
  projectRoot: string,
  options: AssetOptions = {},
): Promise<void> {
  const assetsDir = path.join(macosDir, "Assets.xcassets");
  const iconsetDir = path.join(assetsDir, "AppIcon.appiconset");

  // Ensure directories exist
  fs.mkdirSync(iconsetDir, { recursive: true });

  // Generate Contents.json for the asset catalog
  const assetContents = JSON.stringify(
    {
      info: {
        author: "xcode",
        version: 1,
      },
    },
    null,
    2,
  );
  fs.writeFileSync(path.join(assetsDir, "Contents.json"), assetContents);

  // Generate Contents.json for the icon set
  const iconContents = generateContentsJson();
  fs.writeFileSync(path.join(iconsetDir, "Contents.json"), iconContents);

  // Try to find and generate icons
  const sourceIcon = findSourceIcon(projectRoot);

  if (sourceIcon) {
    console.log("  Generating app icons from", path.basename(sourceIcon));

    try {
      let image = await read(sourceIcon);

      if (options.applyAppleMask) {
        console.log("  Applying Apple icon mask (padding + squircle)");
        image = renderAppleMaskedSource(image);
      }

      for (const { size, scale } of ICON_SIZES) {
        const actualSize = size * scale;
        const filename = `icon_${size}x${size}${scale > 1 ? `@${scale}x` : ""}.png`;
        const outputPath = path.join(iconsetDir, filename);

        // image-js resize() at the same size has an alpha bug that
        // premultiplies and double-mangles values — write the image as-is.
        const out =
          actualSize === image.width
            ? image
            : image.resize({ width: actualSize, height: actualSize });
        await write(outputPath, out);
      }
      console.log("  Created Assets.xcassets with icons");
    } catch (error) {
      console.error("  Warning: Failed to generate icons:", error);
      console.log("  Created Assets.xcassets (add your icons manually)");
    }
  } else {
    console.log(
      "  Created Assets.xcassets (no source icon found, add icons manually)",
    );
  }
}
