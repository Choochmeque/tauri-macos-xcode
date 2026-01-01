import fs from "fs";
import path from "path";
import { TauriConfig, AppInfo } from "../types.js";

export function findProjectRoot(startDir: string = process.cwd()): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "src-tauri"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find Tauri project root (no src-tauri directory)");
}

export function readTauriConfig(projectRoot: string): TauriConfig {
  const configPath = path.join(projectRoot, "src-tauri", "tauri.conf.json");
  if (!fs.existsSync(configPath)) {
    throw new Error(`tauri.conf.json not found at ${configPath}`);
  }
  return JSON.parse(fs.readFileSync(configPath, "utf8"));
}

export function getAppInfo(config: TauriConfig): AppInfo {
  const identifier =
    config.identifier || config.bundle?.identifier || "com.example.app";
  const parts = identifier.split(".");
  const bundleIdPrefix = parts.slice(0, -1).join(".");

  return {
    productName: config.productName || "TauriApp",
    identifier,
    bundleIdPrefix,
    version: config.version || "0.1.0",
    macosDeploymentTarget: "11.0",
  };
}
