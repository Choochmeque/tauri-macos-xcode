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

    it("reads resources from bundle.resources array format", () => {
      // Create src-tauri directory and files for glob expansion
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "assets"), { recursive: true });
      fs.mkdirSync(path.join(srcTauri, "config"), { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "assets", "data.json"), "{}");
      fs.writeFileSync(path.join(srcTauri, "config", "app.json"), "{}");
      fs.writeFileSync(path.join(srcTauri, "config", "settings.json"), "{}");

      const config = {
        bundle: {
          resources: ["assets/data.json", "config/**"],
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toEqual([
        { source: "assets/data.json", target: "" },
        { source: "config/app.json", target: "" },
        { source: "config/settings.json", target: "" },
      ]);
    });

    it("reads resources from bundle.resources object format", () => {
      // Create src-tauri directory and files for glob expansion
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "infoplist"), { recursive: true });
      fs.mkdirSync(path.join(srcTauri, "data"), { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "infoplist", "Info.plist"), "");
      fs.writeFileSync(path.join(srcTauri, "data", "config.json"), "{}");

      const config = {
        bundle: {
          resources: {
            "infoplist/**": "./",
            "data/config.json": "configs",
          },
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toEqual([
        { source: "infoplist/Info.plist", target: "Info.plist" },
        { source: "data/config.json", target: "configs/config.json" },
      ]);
    });

    it("resources is undefined when not specified", () => {
      const config = { bundle: {} };
      const info = getAppInfo(config);
      expect(info.resources).toBeUndefined();
    });

    it("normalizes ./ prefix in resource patterns", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "resources"), { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "resources", "data.json"), "{}");

      const config = {
        bundle: {
          resources: ["./resources/data.json"],
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toEqual([
        { source: "resources/data.json", target: "" },
      ]);
    });

    it("expands *.json single-level wildcard", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "data"), { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "data", "a.json"), "{}");
      fs.writeFileSync(path.join(srcTauri, "data", "b.json"), "{}");
      fs.writeFileSync(path.join(srcTauri, "data", "readme.txt"), "");

      const config = {
        bundle: {
          resources: ["data/*.json"],
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toHaveLength(2);
      expect(info.resources).toContainEqual({
        source: "data/a.json",
        target: "",
      });
      expect(info.resources).toContainEqual({
        source: "data/b.json",
        target: "",
      });
    });

    it("expands ** recursive wildcard", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "resources", "subdir"), {
        recursive: true,
      });
      fs.writeFileSync(path.join(srcTauri, "resources", "a.json"), "{}");
      fs.writeFileSync(
        path.join(srcTauri, "resources", "subdir", "b.json"),
        "{}",
      );

      const config = {
        bundle: {
          resources: ["resources/**"],
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toHaveLength(2);
      expect(info.resources).toContainEqual({
        source: "resources/a.json",
        target: "",
      });
      expect(info.resources).toContainEqual({
        source: "resources/subdir/b.json",
        target: "",
      });
    });

    it("preserves relative paths in object format with glob", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(path.join(srcTauri, "configs", "nested"), {
        recursive: true,
      });
      fs.writeFileSync(path.join(srcTauri, "configs", "app.json"), "{}");
      fs.writeFileSync(
        path.join(srcTauri, "configs", "nested", "deep.json"),
        "{}",
      );

      const config = {
        bundle: {
          resources: {
            "configs/**/*.json": "data",
          },
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toHaveLength(2);
      expect(info.resources).toContainEqual({
        source: "configs/app.json",
        target: "data/app.json",
      });
      expect(info.resources).toContainEqual({
        source: "configs/nested/deep.json",
        target: "data/nested/deep.json",
      });
    });

    it("returns undefined when array resources match no files", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });

      const config = {
        bundle: {
          resources: ["nonexistent/**/*.json"],
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toBeUndefined();
    });

    it("returns undefined when object resources match no files", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });

      const config = {
        bundle: {
          resources: {
            "nonexistent/**/*.json": "dest",
          },
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toBeUndefined();
    });

    it("handles object resources with literal path (no glob)", () => {
      const srcTauri = path.join(tempDir, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "data.json"), "{}");

      const config = {
        bundle: {
          resources: {
            "data.json": "configs",
          },
        },
      };
      const info = getAppInfo(config, tempDir);
      expect(info.resources).toEqual([
        { source: "data.json", target: "configs/data.json" },
      ]);
    });

    it("uses process.cwd() as fallback when no projectRoot provided", () => {
      // When getAppInfo is called without projectRoot, parseResources uses process.cwd()
      // Since pattern won't match any files in cwd, resources will be undefined
      const config = {
        bundle: {
          resources: ["nonexistent-test-pattern-xyz/**"],
        },
      };
      const info = getAppInfo(config);
      expect(info.resources).toBeUndefined();
    });

    it("reads fileAssociations from bundle.fileAssociations", () => {
      const config = {
        bundle: {
          fileAssociations: [
            {
              ext: ["myext"],
              name: "My File Type",
              role: "Editor" as const,
              rank: "Owner" as const,
            },
          ],
        },
      };
      const info = getAppInfo(config);
      expect(info.fileAssociations).toEqual([
        {
          ext: ["myext"],
          name: "My File Type",
          role: "Editor",
          rank: "Owner",
        },
      ]);
    });

    it("strips leading dots from extensions", () => {
      const config = {
        bundle: {
          fileAssociations: [
            {
              ext: [".myext", "other", ".another"],
            },
          ],
        },
      };
      const info = getAppInfo(config);
      expect(info.fileAssociations?.[0].ext).toEqual([
        "myext",
        "other",
        "another",
      ]);
    });

    it("reads fileAssociations with exportedType", () => {
      const config = {
        bundle: {
          fileAssociations: [
            {
              ext: ["myext"],
              contentTypes: ["com.example.myext"],
              exportedType: {
                identifier: "com.example.myext",
                conformsTo: ["public.data", "public.content"],
              },
            },
          ],
        },
      };
      const info = getAppInfo(config);
      expect(info.fileAssociations?.[0].exportedType).toEqual({
        identifier: "com.example.myext",
        conformsTo: ["public.data", "public.content"],
      });
    });

    it("fileAssociations is undefined when not specified", () => {
      const config = { bundle: {} };
      const info = getAppInfo(config);
      expect(info.fileAssociations).toBeUndefined();
    });

    it("fileAssociations is undefined when empty array", () => {
      const config = { bundle: { fileAssociations: [] } };
      const info = getAppInfo(config);
      expect(info.fileAssociations).toBeUndefined();
    });

    it("reads entitlements from bundle.macOS.entitlements", () => {
      const config = {
        bundle: {
          macOS: {
            entitlements: "custom.entitlements",
          },
        },
      };
      const info = getAppInfo(config);
      expect(info.entitlements).toBe("custom.entitlements");
    });

    it("entitlements is undefined when not specified", () => {
      const config = { bundle: { macOS: {} } };
      const info = getAppInfo(config);
      expect(info.entitlements).toBeUndefined();
    });

    it("reads infoPlist from bundle.macOS.infoPlist", () => {
      const config = {
        bundle: {
          macOS: {
            infoPlist: "Info.plist",
          },
        },
      };
      const info = getAppInfo(config);
      expect(info.infoPlist).toBe("Info.plist");
    });

    it("infoPlist is undefined when not specified", () => {
      const config = { bundle: { macOS: {} } };
      const info = getAppInfo(config);
      expect(info.infoPlist).toBeUndefined();
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
