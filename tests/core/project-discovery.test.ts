import { describe, it, expect, beforeEach, afterEach } from "vitest";
import {
  findProjectRoot,
  readTauriConfig,
  getAppInfo,
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
  });
});
