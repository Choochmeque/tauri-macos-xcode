import fs from "fs";
import path from "path";
import { readTemplate } from "../utils/template.js";

export function generateBuildScript(macosDir: string): void {
  const scriptsDir = path.join(macosDir, "scripts");

  // Ensure directory exists
  fs.mkdirSync(scriptsDir, { recursive: true });

  // Copy bash wrapper
  const bashContent = readTemplate("build-rust.sh.template");
  const bashPath = path.join(scriptsDir, "build-rust.sh");
  fs.writeFileSync(bashPath, bashContent);
  fs.chmodSync(bashPath, "755");
  console.log("  Created scripts/build-rust.sh");

  // Copy Swift build script
  const swiftContent = readTemplate("build.swift.template");
  const swiftPath = path.join(scriptsDir, "build.swift");
  fs.writeFileSync(swiftPath, swiftContent);
  fs.chmodSync(swiftPath, "755");
  console.log("  Created scripts/build.swift");
}
