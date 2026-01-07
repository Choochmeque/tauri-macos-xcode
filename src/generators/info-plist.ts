import fs from "fs";
import path from "path";
import { AppInfo } from "../types.js";
import { readTemplate } from "../utils/template.js";

export function generateInfoPlist(macosDir: string, appInfo: AppInfo): void {
  const targetDir = path.join(macosDir, `${appInfo.productName}_macOS`);

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // Load template (uses Xcode build variables, no substitution needed)
  const content = readTemplate("Info.plist.template");

  fs.writeFileSync(path.join(targetDir, "Info.plist"), content);
  console.log(`  Created ${appInfo.productName}_macOS/Info.plist`);
}
