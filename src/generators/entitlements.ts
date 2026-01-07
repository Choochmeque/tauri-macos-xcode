import fs from "fs";
import path from "path";
import { AppInfo } from "../types.js";
import { readTemplate } from "../utils/template.js";

export function generateEntitlements(
  macosDir: string,
  appInfo: AppInfo,
  projectRoot?: string,
): void {
  const targetDir = path.join(macosDir, `${appInfo.productName}_macOS`);

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  let content: string;

  // Use custom entitlements file if specified
  if (appInfo.entitlements && projectRoot) {
    const customPath = path.join(
      projectRoot,
      "src-tauri",
      appInfo.entitlements,
    );
    if (fs.existsSync(customPath)) {
      content = fs.readFileSync(customPath, "utf8");
    } else {
      console.warn(
        `  Warning: Custom entitlements file not found: ${customPath}`,
      );
      content = readTemplate("entitlements.template");
    }
  } else {
    content = readTemplate("entitlements.template");
  }

  const entitlementsPath = path.join(
    targetDir,
    `${appInfo.productName}_macOS.entitlements`,
  );
  fs.writeFileSync(entitlementsPath, content);
  console.log(
    `  Created ${appInfo.productName}_macOS/${appInfo.productName}_macOS.entitlements`,
  );
}
