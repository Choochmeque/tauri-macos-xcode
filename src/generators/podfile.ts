import fs from "fs";
import path from "path";
import { AppInfo, TemplateVars } from "../types.js";
import { processTemplate } from "../utils/template.js";

export function generatePodfile(macosDir: string, appInfo: AppInfo): void {
  const vars: TemplateVars = {
    PRODUCT_NAME: appInfo.productName,
    BUNDLE_IDENTIFIER: appInfo.identifier,
    BUNDLE_ID_PREFIX: appInfo.bundleIdPrefix,
    VERSION: appInfo.version,
    MACOS_DEPLOYMENT_TARGET: appInfo.macosDeploymentTarget,
  };

  const content = processTemplate("Podfile.template", vars);
  fs.writeFileSync(path.join(macosDir, "Podfile"), content);
  console.log("  Created Podfile");
}
