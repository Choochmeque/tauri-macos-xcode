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

    it("project.yml includes category when specified with Apple UTI", () => {
      const appInfoWithCategory = {
        ...mockAppInfo,
        category: "public.app-category.developer-tools",
      };
      generateProjectYml(tempDir, appInfoWithCategory);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("LSApplicationCategoryType");
      expect(content).toContain("public.app-category.developer-tools");
    });

    it("project.yml maps Tauri category to Apple UTI", () => {
      const appInfoWithCategory = {
        ...mockAppInfo,
        category: "Productivity",
      };
      generateProjectYml(tempDir, appInfoWithCategory);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("LSApplicationCategoryType");
      expect(content).toContain("public.app-category.productivity");
    });

    it("project.yml passes through unknown category as-is", () => {
      const appInfoWithUnknownCategory = {
        ...mockAppInfo,
        category: "SomeUnknownCategory",
      };
      generateProjectYml(tempDir, appInfoWithUnknownCategory);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("LSApplicationCategoryType");
      expect(content).toContain("SomeUnknownCategory");
    });

    it("project.yml omits category when not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("LSApplicationCategoryType");
    });

    it("project.yml includes copyright when specified", () => {
      const appInfoWithCopyright = {
        ...mockAppInfo,
        copyright: "Copyright © 2024 Test Company",
      };
      generateProjectYml(tempDir, appInfoWithCopyright);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("INFOPLIST_KEY_NSHumanReadableCopyright");
      expect(content).toContain("Copyright © 2024 Test Company");
    });

    it("project.yml omits copyright when not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("NSHumanReadableCopyright");
    });

    it("project.yml includes both category and copyright when specified", () => {
      const appInfoWithBoth = {
        ...mockAppInfo,
        category: "Productivity",
        copyright: "Copyright © 2024 Test Company",
      };
      generateProjectYml(tempDir, appInfoWithBoth);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("INFOPLIST_KEY_LSApplicationCategoryType");
      expect(content).toContain("public.app-category.productivity");
      expect(content).toContain("INFOPLIST_KEY_NSHumanReadableCopyright");
      expect(content).toContain("Copyright © 2024 Test Company");
    });

    it("project.yml includes embedded frameworks when specified with path", () => {
      const appInfoWithFrameworks = {
        ...mockAppInfo,
        frameworks: ["vendor/Sparkle.framework", "libs/MyLib.framework"],
      };
      generateProjectYml(tempDir, appInfoWithFrameworks);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("- framework: vendor/Sparkle.framework");
      expect(content).toContain("embed: true");
      expect(content).toContain("- framework: libs/MyLib.framework");
    });

    it("project.yml adds system frameworks as SDK dependencies", () => {
      const appInfoWithSystemFrameworks = {
        ...mockAppInfo,
        frameworks: ["CoreAudio", "AVFoundation"],
      };
      generateProjectYml(tempDir, appInfoWithSystemFrameworks);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("- sdk: CoreAudio.framework");
      expect(content).toContain("- sdk: AVFoundation.framework");
      expect(content).not.toContain("embed: true");
    });

    it("project.yml copies dylibs to frameworks directory", () => {
      const appInfoWithDylibs = {
        ...mockAppInfo,
        frameworks: ["./libs/libmsodbcsql.18.dylib"],
      };
      generateProjectYml(tempDir, appInfoWithDylibs);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("copyFiles:");
      expect(content).toContain("path: ./libs/libmsodbcsql.18.dylib");
      expect(content).toContain("destination: frameworks");
    });

    it("project.yml groups multiple dylibs together", () => {
      const appInfoWithDylibs = {
        ...mockAppInfo,
        frameworks: ["./libs/lib1.dylib", "./libs/lib2.dylib"],
      };
      generateProjectYml(tempDir, appInfoWithDylibs);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: frameworks");
      expect(content).toContain("path: ./libs/lib1.dylib");
      expect(content).toContain("path: ./libs/lib2.dylib");
      // Should only have one frameworks destination entry
      const matches = content.match(/destination: frameworks/g);
      expect(matches?.length).toBe(1);
    });

    it("project.yml handles mixed framework types", () => {
      const appInfoWithMixed = {
        ...mockAppInfo,
        frameworks: [
          "CoreAudio",
          "./libs/libmsodbcsql.18.dylib",
          "./frameworks/MyApp.framework",
        ],
      };
      generateProjectYml(tempDir, appInfoWithMixed);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // System framework
      expect(content).toContain("- sdk: CoreAudio.framework");
      // Embedded framework
      expect(content).toContain("- framework: ./frameworks/MyApp.framework");
      expect(content).toContain("embed: true");
      // Dylib copied to frameworks
      expect(content).toContain("copyFiles:");
      expect(content).toContain("path: ./libs/libmsodbcsql.18.dylib");
      expect(content).toContain("destination: frameworks");
    });

    it("project.yml omits frameworks when not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("- framework:");
      expect(content).not.toContain("embed: true");
    });

    it("project.yml copies file to wrapper for Contents/ destination", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "embedded.provisionprofile": "./profile.provisionprofile",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: wrapper");
      expect(content).toContain("path: ./profile.provisionprofile");
    });

    it("project.yml copies file to sharedSupport for SharedSupport/ destination", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/docs.md": "./docs/index.md",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("path: ./docs/index.md");
    });

    it("project.yml uses subpath for nested destinations", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/data/config.json": "./config.json",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("subpath: data");
      expect(content).toContain("path: ./config.json");
    });

    it("project.yml uses wrapper with subpath for unknown directories", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "CustomFolder/nested/file.txt": "./source.txt",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: wrapper");
      expect(content).toContain("subpath: CustomFolder/nested");
      expect(content).toContain("path: ./source.txt");
    });

    it("project.yml groups multiple files with same destination", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/file1.txt": "./src/file1.txt",
          "SharedSupport/file2.txt": "./src/file2.txt",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("path: ./src/file1.txt");
      expect(content).toContain("path: ./src/file2.txt");
      // Should only have one destination entry, not two
      const matches = content.match(/destination: sharedSupport/g);
      expect(matches?.length).toBe(1);
    });

    it("project.yml omits copyFiles when files not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("copyFiles:");
    });

    it("project.yml includes both frameworks and files when specified", () => {
      const appInfoWithBoth = {
        ...mockAppInfo,
        frameworks: ["vendor/Sparkle.framework"],
        files: {
          "Resources/config.json": "./assets/config.json",
        },
      };
      generateProjectYml(tempDir, appInfoWithBoth);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("- framework: vendor/Sparkle.framework");
      expect(content).toContain("embed: true");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: resources");
      expect(content).toContain("path: ./assets/config.json");
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
      expect(content).toContain("$(MARKETING_VERSION)");
      expect(content).toContain("$(MACOSX_DEPLOYMENT_TARGET)");
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
