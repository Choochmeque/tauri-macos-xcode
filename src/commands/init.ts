import path from "path";
import fs from "fs";
import {
  findProjectRoot,
  readTauriConfig,
  getAppInfo,
  detectPackageManager,
} from "../core/project-discovery.js";
import { generateProjectYml } from "../generators/project-yml.js";
import { generateInfoPlist } from "../generators/info-plist.js";
import { generateEntitlements } from "../generators/entitlements.js";
import { generateAssets } from "../generators/assets.js";
import { generateBuildScript } from "../generators/build-script.js";
import { generatePodfile } from "../generators/podfile.js";
import { runXcodeGen } from "../core/xcodegen.js";
import { InitOptions } from "../types.js";

function updatePackageJson(projectRoot: string): void {
  const pkgPath = path.join(projectRoot, "package.json");
  const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));

  // Add devDependency
  pkg.devDependencies = pkg.devDependencies || {};
  pkg.devDependencies["@choochmeque/tauri-macos-xcode"] = "^0.1.0";

  // Add script
  pkg.scripts = pkg.scripts || {};
  if (!pkg.scripts["tauri:macos:dev"]) {
    pkg.scripts["tauri:macos:dev"] = "tauri-macos-xcode dev --open";
  }

  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + "\n");
  console.log("Updated package.json with tauri:macos:dev script");
}

export async function init(options: InitOptions): Promise<void> {
  const projectRoot = options.path || findProjectRoot();
  const tauriConfig = readTauriConfig(projectRoot);
  const appInfo = getAppInfo(tauriConfig);

  const macosDir = path.join(projectRoot, "src-tauri", "gen", "apple-macos");

  console.log(`Creating macOS Xcode project for "${appInfo.productName}"...`);
  console.log("");

  // Create directory structure
  fs.mkdirSync(macosDir, { recursive: true });
  fs.mkdirSync(path.join(macosDir, `${appInfo.productName}_macOS`), {
    recursive: true,
  });
  fs.mkdirSync(path.join(macosDir, "Assets.xcassets", "AppIcon.appiconset"), {
    recursive: true,
  });
  fs.mkdirSync(path.join(macosDir, "scripts"), { recursive: true });

  // Generate files
  generateProjectYml(macosDir, appInfo, projectRoot);
  generateInfoPlist(macosDir, appInfo);
  await generateAssets(macosDir, appInfo, projectRoot);
  generateBuildScript(macosDir);
  generatePodfile(macosDir, appInfo);

  // Generate .gitignore
  fs.writeFileSync(path.join(macosDir, ".gitignore"), "xcuserdata/\nbuild/\n");
  console.log("  Created .gitignore");

  console.log("");

  // Run XcodeGen
  await runXcodeGen(macosDir);

  // Generate entitlements AFTER XcodeGen (XcodeGen may create empty entitlements)
  generateEntitlements(macosDir, appInfo, projectRoot);

  console.log("");

  // Update package.json with script and devDependency
  updatePackageJson(projectRoot);

  console.log("");
  console.log("macOS Xcode project created successfully!");
  console.log("");

  const pm = detectPackageManager(projectRoot);
  console.log("Next steps:");
  console.log(`  1. Run: ${pm} install`);
  console.log(`  2. Run: ${pm} tauri:macos:dev`);
}
