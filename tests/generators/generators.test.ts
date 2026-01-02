import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { Jimp } from "jimp";
import { AppInfo } from "../../src/types.js";
import { generateProjectYml } from "../../src/generators/project-yml.js";
import { generateInfoPlist } from "../../src/generators/info-plist.js";
import { generateEntitlements } from "../../src/generators/entitlements.js";
import { generateBuildScript } from "../../src/generators/build-script.js";
import { generatePodfile } from "../../src/generators/podfile.js";
import { generateSources } from "../../src/generators/sources.js";
import { generateAssets } from "../../src/generators/assets.js";

async function createTestPng(
  filePath: string,
  size: number = 512,
): Promise<void> {
  const image = new Jimp({ width: size, height: size, color: 0xff0000ff });
  await image.write(filePath as `${string}.${string}`);
}

describe("generators", () => {
  let tempDir: string;
  const mockAppInfo: AppInfo = {
    productName: "TestApp",
    identifier: "com.test.testapp",
    bundleIdPrefix: "com.test",
    version: "1.0.0",
    macosDeploymentTarget: "11.0",
  };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-gen-test-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
    vi.restoreAllMocks();
  });

  describe("generateProjectYml", () => {
    it("creates project.yml file", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const filePath = path.join(tempDir, "project.yml");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("project.yml contains correct product name", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("TestApp");
      expect(content).toContain("com.test.testapp");
    });
  });

  describe("generateInfoPlist", () => {
    it("creates Info.plist in correct directory", () => {
      generateInfoPlist(tempDir, mockAppInfo);
      const filePath = path.join(tempDir, "TestApp_macOS", "Info.plist");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("creates target directory if not exists", () => {
      generateInfoPlist(tempDir, mockAppInfo);
      const targetDir = path.join(tempDir, "TestApp_macOS");
      expect(fs.existsSync(targetDir)).toBe(true);
    });

    it("Info.plist contains correct values", () => {
      generateInfoPlist(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "TestApp_macOS", "Info.plist"),
        "utf8",
      );
      expect(content).toContain("1.0.0");
      expect(content).toContain("11.0");
    });
  });

  describe("generateEntitlements", () => {
    it("creates entitlements file", () => {
      generateEntitlements(tempDir, mockAppInfo);
      const filePath = path.join(
        tempDir,
        "TestApp_macOS",
        "TestApp_macOS.entitlements",
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("entitlements file is valid plist", () => {
      generateEntitlements(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "TestApp_macOS", "TestApp_macOS.entitlements"),
        "utf8",
      );
      expect(content).toContain("<?xml");
      expect(content).toContain("plist");
    });
  });

  describe("generateBuildScript", () => {
    it("creates build-rust.sh in scripts directory", () => {
      generateBuildScript(tempDir);
      const filePath = path.join(tempDir, "scripts", "build-rust.sh");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("script is executable", () => {
      generateBuildScript(tempDir);
      const filePath = path.join(tempDir, "scripts", "build-rust.sh");
      const stats = fs.statSync(filePath);
      const mode = stats.mode & 0o777;
      expect(mode & 0o111).toBeGreaterThan(0);
    });

    it("script contains shebang", () => {
      generateBuildScript(tempDir);
      const content = fs.readFileSync(
        path.join(tempDir, "scripts", "build-rust.sh"),
        "utf8",
      );
      expect(content.startsWith("#!/")).toBe(true);
    });
  });

  describe("generatePodfile", () => {
    it("creates Podfile", () => {
      generatePodfile(tempDir, mockAppInfo);
      const filePath = path.join(tempDir, "Podfile");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("Podfile contains product name", () => {
      generatePodfile(tempDir, mockAppInfo);
      const content = fs.readFileSync(path.join(tempDir, "Podfile"), "utf8");
      expect(content).toContain("TestApp");
    });
  });

  describe("generateSources", () => {
    it("creates main.mm file", () => {
      generateSources(tempDir, mockAppInfo);
      const filePath = path.join(tempDir, "Sources", "TestApp", "main.mm");
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("creates bindings.h file", () => {
      generateSources(tempDir, mockAppInfo);
      const filePath = path.join(
        tempDir,
        "Sources",
        "TestApp",
        "bindings",
        "bindings.h",
      );
      expect(fs.existsSync(filePath)).toBe(true);
    });

    it("creates directory structure", () => {
      generateSources(tempDir, mockAppInfo);
      expect(
        fs.existsSync(path.join(tempDir, "Sources", "TestApp", "bindings")),
      ).toBe(true);
    });
  });

  describe("generateAssets", () => {
    it("creates Assets.xcassets directory", async () => {
      await generateAssets(tempDir, mockAppInfo, tempDir);
      const assetsDir = path.join(tempDir, "Assets.xcassets");
      expect(fs.existsSync(assetsDir)).toBe(true);
    });

    it("creates AppIcon.appiconset directory", async () => {
      await generateAssets(tempDir, mockAppInfo, tempDir);
      const iconsetDir = path.join(
        tempDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
      );
      expect(fs.existsSync(iconsetDir)).toBe(true);
    });

    it("creates Contents.json for asset catalog", async () => {
      await generateAssets(tempDir, mockAppInfo, tempDir);
      const contentsPath = path.join(
        tempDir,
        "Assets.xcassets",
        "Contents.json",
      );
      expect(fs.existsSync(contentsPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(contentsPath, "utf8"));
      expect(content.info.author).toBe("xcode");
    });

    it("creates Contents.json for icon set", async () => {
      await generateAssets(tempDir, mockAppInfo, tempDir);
      const contentsPath = path.join(
        tempDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
        "Contents.json",
      );
      expect(fs.existsSync(contentsPath)).toBe(true);
      const content = JSON.parse(fs.readFileSync(contentsPath, "utf8"));
      expect(content.images).toBeDefined();
      expect(content.images.length).toBe(10);
    });

    it("handles missing source icon gracefully", async () => {
      await generateAssets(tempDir, mockAppInfo, tempDir);
      // Should not throw, just create the structure without icons
      expect(fs.existsSync(path.join(tempDir, "Assets.xcassets"))).toBe(true);
    });

    it("generates icons from source icon.png", async () => {
      const iconsDir = path.join(tempDir, "src-tauri", "icons");
      fs.mkdirSync(iconsDir, { recursive: true });

      await createTestPng(path.join(iconsDir, "icon.png"), 512);

      const macosDir = path.join(tempDir, "macos");
      fs.mkdirSync(macosDir, { recursive: true });

      await generateAssets(macosDir, mockAppInfo, tempDir);

      const iconsetDir = path.join(
        macosDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
      );
      expect(fs.existsSync(path.join(iconsetDir, "icon_16x16.png"))).toBe(true);
      expect(fs.existsSync(path.join(iconsetDir, "icon_32x32.png"))).toBe(true);
      expect(fs.existsSync(path.join(iconsetDir, "icon_512x512.png"))).toBe(
        true,
      );
      expect(fs.existsSync(path.join(iconsetDir, "icon_512x512@2x.png"))).toBe(
        true,
      );
    });

    it("finds 128x128@2x.png as fallback source icon", async () => {
      const iconsDir = path.join(tempDir, "src-tauri", "icons");
      fs.mkdirSync(iconsDir, { recursive: true });

      await createTestPng(path.join(iconsDir, "128x128@2x.png"), 256);

      const macosDir = path.join(tempDir, "macos");
      fs.mkdirSync(macosDir, { recursive: true });

      await generateAssets(macosDir, mockAppInfo, tempDir);

      const iconsetDir = path.join(
        macosDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
      );
      expect(fs.existsSync(path.join(iconsetDir, "icon_16x16.png"))).toBe(true);
    });

    it("handles icon generation error gracefully", async () => {
      const iconsDir = path.join(tempDir, "src-tauri", "icons");
      fs.mkdirSync(iconsDir, { recursive: true });

      // Create an invalid PNG file that jimp cannot process
      fs.writeFileSync(
        path.join(iconsDir, "icon.png"),
        "not a valid png file content",
      );

      const macosDir = path.join(tempDir, "macos");
      fs.mkdirSync(macosDir, { recursive: true });

      const consoleSpy = vi.spyOn(console, "error");

      // Should not throw, should handle error gracefully
      await generateAssets(macosDir, mockAppInfo, tempDir);

      // Should have logged a warning about failed icon generation
      expect(consoleSpy).toHaveBeenCalledWith(
        expect.stringContaining("Warning: Failed to generate icons:"),
        expect.anything(),
      );

      // Assets structure should still be created
      expect(fs.existsSync(path.join(macosDir, "Assets.xcassets"))).toBe(true);
    });
  });
});
