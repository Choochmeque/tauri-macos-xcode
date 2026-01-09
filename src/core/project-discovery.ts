import fs from "fs";
import path from "path";
import {
  TauriConfig,
  AppInfo,
  ResourceMapping,
  FileAssociation,
} from "../types.js";
import { expandGlob, getGlobBase } from "./glob-utils.js";

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
  basePath?: string,
): ResourceMapping[] | undefined {
  if (!resources) return undefined;

  const cwd = basePath || process.cwd();
  const results: ResourceMapping[] = [];

  if (Array.isArray(resources)) {
    // Array format: ["path/to/file", "pattern/*.json"] → copies to Resources root
    for (const pattern of resources) {
      const files = expandGlob(pattern, cwd);
      for (const file of files) {
        results.push({ source: file, target: "" });
      }
    }
    return results.length > 0 ? results : undefined;
  }

  // Object format: { "source/path": "target/path", "pattern/**": "dest" }
  for (const [pattern, target] of Object.entries(resources)) {
    const files = expandGlob(pattern, cwd);
    const globBase = getGlobBase(pattern);

    for (const file of files) {
      // Calculate relative path from glob base for directory preservation
      const relativePath = globBase ? file.slice(globBase.length + 1) : file;

      // Normalize target: "." means root
      const normalizedTarget =
        target === "." || target === "./" ? "" : target.replace(/^\.\//, "");

      // Combine target with relative path
      const finalTarget = normalizedTarget
        ? path.posix.join(normalizedTarget, relativePath)
        : relativePath;

      results.push({ source: file, target: finalTarget });
    }
  }

  return results.length > 0 ? results : undefined;
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

export function getAppInfo(config: TauriConfig, projectRoot?: string): AppInfo {
  const identifier =
    config.identifier || config.bundle?.identifier || "com.example.app";
  const parts = identifier.split(".");
  const bundleIdPrefix = parts.slice(0, -1).join(".");

  // basePath for glob expansion is src-tauri directory
  const basePath = projectRoot
    ? path.join(projectRoot, "src-tauri")
    : undefined;

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
    resources: parseResources(config.bundle?.resources, basePath),
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
