import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  findProjectRoot,
  readTauriConfig,
  getAppInfo,
  detectPackageManager,
} from "../../src/core/project-discovery.js";
import fs from "fs";
import path from "path";
import os from "os";

describe("project-discovery", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-test-"));
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
  });

  describe("findProjectRoot", () => {
    it("finds project root with src-tauri directory", () => {
      fs.mkdirSync(path.join(tempDir, "src-tauri"));
      const result = findProjectRoot(tempDir);
      expect(result).toBe(tempDir);
    });

    it("finds project root from subdirectory", () => {
      fs.mkdirSync(path.join(tempDir, "src-tauri"));
      const subDir = path.join(tempDir, "src", "components");
      fs.mkdirSync(subDir, { recursive: true });
      const result = findProjectRoot(subDir);
      expect(result).toBe(tempDir);
    });

    it("throws when no src-tauri found", () => {
      expect(() => findProjectRoot(tempDir)).toThrow(
        "Could not find Tauri project root",
      );
    });
  });

  describe("readTauriConfig", () => {
    it("reads tauri config", () => {
      fs.mkdirSync(path.join(tempDir, "src-tauri"));
      fs.writeFileSync(
        path.join(tempDir, "src-tauri", "tauri.conf.json"),
        JSON.stringify({ productName: "TestApp", version: "1.0.0" }),
      );
      const config = readTauriConfig(tempDir);
      expect(config.productName).toBe("TestApp");
      expect(config.version).toBe("1.0.0");
    });

    it("throws when config not found", () => {
      fs.mkdirSync(path.join(tempDir, "src-tauri"));
      expect(() => readTauriConfig(tempDir)).toThrow(
        "tauri.conf.json not found",
      );
    });
  });

  describe("getAppInfo", () => {
    it("extracts app info from config", () => {
      const config = {
        productName: "MyApp",
        identifier: "com.example.myapp",
        version: "2.0.0",
      };
      const info = getAppInfo(config);
      expect(info.productName).toBe("MyApp");
      expect(info.identifier).toBe("com.example.myapp");
      expect(info.bundleIdPrefix).toBe("com.example");
      expect(info.version).toBe("2.0.0");
      expect(info.macosDeploymentTarget).toBe("11.0");
    });

    it("uses bundle.identifier as fallback", () => {
      const config = { bundle: { identifier: "com.fallback.app" } };
      const info = getAppInfo(config);
      expect(info.identifier).toBe("com.fallback.app");
      expect(info.bundleIdPrefix).toBe("com.fallback");
    });

    it("uses defaults when config is empty", () => {
      const config = {};
      const info = getAppInfo(config);
      expect(info.productName).toBe("TauriApp");
      expect(info.identifier).toBe("com.example.app");
      expect(info.bundleIdPrefix).toBe("com.example");
      expect(info.version).toBe("0.1.0");
    });

    it("reads minimumSystemVersion from bundle.macOS", () => {
      const config = {
        bundle: {
          macOS: {
            minimumSystemVersion: "12.0",
          },
        },
      };
      const info = getAppInfo(config);
      expect(info.macosDeploymentTarget).toBe("12.0");
    });

    it("uses default macosDeploymentTarget when not specified", () => {
      const config = { bundle: {} };
      const info = getAppInfo(config);
      expect(info.macosDeploymentTarget).toBe("11.0");
    });

    it("reads category from bundle.category", () => {
      const config = {
        bundle: {
          category: "public.app-category.developer-tools",
        },
      };
      const info = getAppInfo(config);
      expect(info.category).toBe("public.app-category.developer-tools");
    });

    it("category is undefined when not specified", () => {
      const config = { bundle: {} };
      const info = getAppInfo(config);
      expect(info.category).toBeUndefined();
    });

    it("reads copyright from bundle.copyright", () => {
      const config = {
        bundle: {
          copyright: "Copyright © 2024 Test Company",
        },
      };
      const info = getAppInfo(config);
      expect(info.copyright).toBe("Copyright © 2024 Test Company");
    });

    it("copyright is undefined when not specified", () => {
      const config = { bundle: {} };
      const info = getAppInfo(config);
      expect(info.copyright).toBeUndefined();
    });

    it("reads files from bundle.macOS.files", () => {
      const config = {
        bundle: {
          macOS: {
            files: {
              resources: "assets/data.json",
              "frameworks/libs": "vendor/libfoo.dylib",
            },
          },
        },
      };
      const info = getAppInfo(config);
      expect(info.files).toEqual({
        resources: "assets/data.json",
        "frameworks/libs": "vendor/libfoo.dylib",
      });
    });

    it("files is undefined when not specified", () => {
      const config = { bundle: { macOS: {} } };
      const info = getAppInfo(config);
      expect(info.files).toBeUndefined();
    });

    it("reads frameworks from bundle.macOS.frameworks", () => {
      const config = {
        bundle: {
          macOS: {
            frameworks: [
              "vendor/Sparkle.framework",
              "libs/MyFramework.framework",
            ],
          },
        },
      };
      const info = getAppInfo(config);
      expect(info.frameworks).toEqual([
        "vendor/Sparkle.framework",
        "libs/MyFramework.framework",
      ]);
    });

    it("frameworks is undefined when not specified", () => {
      const config = { bundle: { macOS: {} } };
      const info = getAppInfo(config);
      expect(info.frameworks).toBeUndefined();
    });
  });

  describe("detectPackageManager", () => {
    it("detects pnpm from lock file", () => {
      fs.writeFileSync(path.join(tempDir, "pnpm-lock.yaml"), "");
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });

    it("detects yarn from lock file", () => {
      fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("detects bun from lock file", () => {
      fs.writeFileSync(path.join(tempDir, "bun.lockb"), "");
      expect(detectPackageManager(tempDir)).toBe("bun");
    });

    it("detects npm from lock file", () => {
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      expect(detectPackageManager(tempDir)).toBe("npm");
    });

    it("prioritizes pnpm over other lock files", () => {
      fs.writeFileSync(path.join(tempDir, "pnpm-lock.yaml"), "");
      fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
      fs.writeFileSync(path.join(tempDir, "package-lock.json"), "{}");
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });

    it("detects pnpm from packageManager field", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "pnpm@8.0.0" }),
      );
      expect(detectPackageManager(tempDir)).toBe("pnpm");
    });

    it("detects yarn from packageManager field", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "yarn@4.0.0" }),
      );
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("detects bun from packageManager field", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "bun@1.0.0" }),
      );
      expect(detectPackageManager(tempDir)).toBe("bun");
    });

    it("detects npm from packageManager field", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "npm@10.0.0" }),
      );
      expect(detectPackageManager(tempDir)).toBe("npm");
    });

    it("handles invalid JSON in package.json gracefully", () => {
      fs.writeFileSync(path.join(tempDir, "package.json"), "not valid json");
      fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("packageManager field takes priority over lock files", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "yarn@4.0.0" }),
      );
      fs.writeFileSync(path.join(tempDir, "pnpm-lock.yaml"), "");
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("defaults to npm when no lock file found", () => {
      expect(detectPackageManager(tempDir)).toBe("npm");
    });

    it("falls back to lock files when packageManager is unknown", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ packageManager: "unknown@1.0.0" }),
      );
      fs.writeFileSync(path.join(tempDir, "yarn.lock"), "");
      expect(detectPackageManager(tempDir)).toBe("yarn");
    });

    it("falls back to lock files when package.json has no packageManager", () => {
      fs.writeFileSync(
        path.join(tempDir, "package.json"),
        JSON.stringify({ name: "test-package" }),
      );
      fs.writeFileSync(path.join(tempDir, "bun.lockb"), "");
      expect(detectPackageManager(tempDir)).toBe("bun");
    });
  });
});
