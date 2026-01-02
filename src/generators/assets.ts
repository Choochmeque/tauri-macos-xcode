import fs from "fs";
import path from "path";
import { Jimp } from "jimp";
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
      const image = await Jimp.read(sourceIcon);

      for (const { size, scale } of ICON_SIZES) {
        const actualSize = size * scale;
        const filename = `icon_${size}x${size}${scale > 1 ? `@${scale}x` : ""}.png`;
        const outputPath = path.join(iconsetDir, filename);

        // Clone and resize the image
        const resized = image.clone().resize({ w: actualSize, h: actualSize });
        await resized.write(outputPath as `${string}.${string}`);
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
