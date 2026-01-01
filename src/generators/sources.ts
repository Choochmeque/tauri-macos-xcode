import fs from "fs";
import path from "path";
import { AppInfo } from "../types.js";
import { readTemplate } from "../utils/template.js";

export function generateSources(macosDir: string, appInfo: AppInfo): void {
  const sourcesDir = path.join(macosDir, "Sources", appInfo.productName);
  const bindingsDir = path.join(sourcesDir, "bindings");

  // Ensure directories exist
  fs.mkdirSync(bindingsDir, { recursive: true });

  // Generate main.mm
  const mainContent = readTemplate("main.mm.template");
  fs.writeFileSync(path.join(sourcesDir, "main.mm"), mainContent);
  console.log("  Created Sources/main.mm");

  // Generate bindings.h
  const bindingsContent = readTemplate("bindings.h.template");
  fs.writeFileSync(path.join(bindingsDir, "bindings.h"), bindingsContent);
  console.log("  Created Sources/bindings/bindings.h");
}
