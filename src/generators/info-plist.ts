import fs from "fs";
import path from "path";
import { AppInfo, TemplateVars } from "../types.js";
import { processTemplate } from "../utils/template.js";

export function generateInfoPlist(macosDir: string, appInfo: AppInfo): void {
  const targetDir = path.join(macosDir, `${appInfo.productName}_macOS`);

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  const vars: TemplateVars = {
    PRODUCT_NAME: appInfo.productName,
    BUNDLE_IDENTIFIER: appInfo.identifier,
    BUNDLE_ID_PREFIX: appInfo.bundleIdPrefix,
    VERSION: appInfo.version,
    MACOS_DEPLOYMENT_TARGET: appInfo.macosDeploymentTarget,
  };

  const content = processTemplate("Info.plist.template", vars);
  fs.writeFileSync(path.join(targetDir, "Info.plist"), content);
  console.log(`  Created ${appInfo.productName}_macOS/Info.plist`);
}
