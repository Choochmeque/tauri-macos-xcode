import fs from "fs";
import path from "path";
import {
  TauriConfig,
  AppInfo,
  ResourceMapping,
  FileAssociation,
} from "../types.js";

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

function parseResources(
  resources: string[] | Record<string, string> | undefined,
): ResourceMapping[] | undefined {
  if (!resources) return undefined;

  if (Array.isArray(resources)) {
    // Array format: ["path/to/file"] → copies to Resources root
    return resources.map((source) => ({ source, target: "" }));
  }

  // Object format: { "source/path": "target/path" }
  return Object.entries(resources).map(([source, target]) => ({
    source,
    target,
  }));
}

function parseFileAssociations(
  associations: FileAssociation[] | undefined,
): FileAssociation[] | undefined {
  if (!associations || associations.length === 0) return undefined;

  // Strip leading dots from extensions
  return associations.map((assoc) => ({
    ...assoc,
    ext: assoc.ext.map((e) => (e.startsWith(".") ? e.slice(1) : e)),
  }));
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
    macosDeploymentTarget: config.bundle?.macOS?.minimumSystemVersion || "11.0",
    category: config.bundle?.category,
    copyright: config.bundle?.copyright,
    files: config.bundle?.macOS?.files,
    frameworks: config.bundle?.macOS?.frameworks,
    resources: parseResources(config.bundle?.resources),
    fileAssociations: parseFileAssociations(config.bundle?.fileAssociations),
    entitlements: config.bundle?.macOS?.entitlements,
    infoPlist: config.bundle?.macOS?.infoPlist,
  };
}

export type PackageManager = "npm" | "yarn" | "pnpm" | "bun";

export function detectPackageManager(projectRoot: string): PackageManager {
  // Check packageManager field in package.json first
  const pkgPath = path.join(projectRoot, "package.json");
  if (fs.existsSync(pkgPath)) {
    try {
      const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
      if (pkg.packageManager) {
        if (pkg.packageManager.startsWith("pnpm")) return "pnpm";
        if (pkg.packageManager.startsWith("yarn")) return "yarn";
        if (pkg.packageManager.startsWith("bun")) return "bun";
        if (pkg.packageManager.startsWith("npm")) return "npm";
      }
    } catch {
      // Ignore parse errors
    }
  }

  // Fall back to lock file detection with priority
  if (fs.existsSync(path.join(projectRoot, "pnpm-lock.yaml"))) return "pnpm";
  if (fs.existsSync(path.join(projectRoot, "yarn.lock"))) return "yarn";
  if (fs.existsSync(path.join(projectRoot, "bun.lockb"))) return "bun";
  if (fs.existsSync(path.join(projectRoot, "package-lock.json"))) return "npm";

  // Default to npm
  return "npm";
}
