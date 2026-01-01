import fs from "fs";
import path from "path";
import { AppInfo } from "../types.js";
import { readTemplate } from "../utils/template.js";

export function generateEntitlements(macosDir: string, appInfo: AppInfo): void {
  const targetDir = path.join(macosDir, `${appInfo.productName}_macOS`);

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  const content = readTemplate("entitlements.template");
  const entitlementsPath = path.join(
    targetDir,
    `${appInfo.productName}_macOS.entitlements`,
  );
  fs.writeFileSync(entitlementsPath, content);
  console.log(
    `  Created ${appInfo.productName}_macOS/${appInfo.productName}_macOS.entitlements`,
  );
}
