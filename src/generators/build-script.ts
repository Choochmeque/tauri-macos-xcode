import fs from "fs";
import path from "path";
import { readTemplate } from "../utils/template.js";

export function generateBuildScript(macosDir: string): void {
  const scriptsDir = path.join(macosDir, "scripts");

  // Ensure directory exists
  fs.mkdirSync(scriptsDir, { recursive: true });

  const content = readTemplate("build-rust.sh.template");
  const scriptPath = path.join(scriptsDir, "build-rust.sh");
  fs.writeFileSync(scriptPath, content);

  // Make the script executable
  fs.chmodSync(scriptPath, "755");

  console.log("  Created scripts/build-rust.sh");
}
