import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync } from "child_process";
import { init } from "../../src/commands/init.js";

const FIXTURE_PATH = path.join(__dirname, "../fixtures/integration-app");

function checkPrerequisite(command: string): boolean {
  try {
    execSync(command, { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

describe("Integration: Init Command", () => {
  let testDir: string;
  let macosDir: string;

  const hasXcodegen = checkPrerequisite("which xcodegen");

  beforeAll(async () => {
    if (!hasXcodegen) {
      console.warn("XcodeGen not installed - some tests will be skipped");
    }

    // Copy fixture to temp directory (exclude target/ and node_modules/)
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-integration-"));
    fs.cpSync(FIXTURE_PATH, testDir, {
      recursive: true,
      filter: (src) =>
        !src.includes("/target/") && !src.includes("/node_modules/"),
    });

    // Silence console output during init
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "warn").mockImplementation(() => {});

    // Run init command
    await init({ path: testDir });

    macosDir = path.join(testDir, "src-tauri", "gen", "apple-macos");
  });

  afterAll(() => {
    vi.restoreAllMocks();
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Directory structure", () => {
    it("creates apple-macos directory", () => {
      expect(fs.existsSync(macosDir)).toBe(true);
    });

    it("creates IntegrationTestApp_macOS directory", () => {
      expect(
        fs.existsSync(path.join(macosDir, "IntegrationTestApp_macOS")),
      ).toBe(true);
    });

    it("creates Assets.xcassets directory", () => {
      expect(fs.existsSync(path.join(macosDir, "Assets.xcassets"))).toBe(true);
    });

    it("creates scripts directory", () => {
      expect(fs.existsSync(path.join(macosDir, "scripts"))).toBe(true);
    });
  });

  describe("project.yml content", () => {
    let projectYml: string;

    beforeAll(() => {
      projectYml = fs.readFileSync(path.join(macosDir, "project.yml"), "utf8");
    });

    it("contains correct product name", () => {
      expect(projectYml).toContain("name: IntegrationTestApp");
    });

    it("contains correct bundle identifier", () => {
      expect(projectYml).toContain(
        "PRODUCT_BUNDLE_IDENTIFIER: com.test.integration",
      );
    });

    it("contains correct macOS deployment target", () => {
      expect(projectYml).toContain('macOS: "13.0"');
    });

    it("contains correct marketing version", () => {
      expect(projectYml).toContain("MARKETING_VERSION: 1.2.3");
    });

    it("contains category build setting", () => {
      expect(projectYml).toContain(
        "INFOPLIST_KEY_LSApplicationCategoryType: public.app-category.developer-tools",
      );
    });

    it("contains copyright build setting", () => {
      expect(projectYml).toContain("INFOPLIST_KEY_NSHumanReadableCopyright:");
      expect(projectYml).toContain("Copyright © 2024 Test");
    });

    it("contains file associations (CFBundleDocumentTypes)", () => {
      expect(projectYml).toContain("CFBundleDocumentTypes:");
      expect(projectYml).toContain("CFBundleTypeName: Test File");
      expect(projectYml).toContain("CFBundleTypeRole: Editor");
      expect(projectYml).toContain("- testfile");
    });

    it("contains system framework dependencies", () => {
      expect(projectYml).toContain("sdk: CoreAudio.framework");
      expect(projectYml).toContain("sdk: CoreBluetooth.framework");
    });

    it("contains resources copyFiles as source with buildPhase", () => {
      expect(projectYml).toContain("path: ../../resources/data.json");
      expect(projectYml).toContain("buildPhase:");
      expect(projectYml).toContain("copyFiles:");
      expect(projectYml).toContain("destination: resources");
    });

    it("contains resources with custom destination (CustomDir)", () => {
      expect(projectYml).toContain("path: ../../resources/subdir/nested.txt");
      expect(projectYml).toContain("subpath: CustomDir");
    });

    it("contains files copyFiles for SharedSupport", () => {
      expect(projectYml).toContain("path: ../../files/support-file.txt");
      expect(projectYml).toContain("destination: sharedSupport");
    });

    it("contains executables as embedded dependency with code signing", () => {
      expect(projectYml).toContain("framework: ../../files/helper-binary");
      expect(projectYml).toContain("embed: true");
      expect(projectYml).toContain("codeSign: true");
      expect(projectYml).toContain("destination: executables");
    });

    it("contains plugins as embedded dependency with code signing", () => {
      expect(projectYml).toContain("framework: ../../files/plugin.bundle");
      expect(projectYml).toContain("destination: plugins");
    });

    it("contains dylib as embedded dependency", () => {
      expect(projectYml).toContain("framework: ../../frameworks/TestLib.dylib");
      expect(projectYml).toContain("embed: true");
    });

    it("contains custom Info.plist keys merged", () => {
      expect(projectYml).toContain("CustomTestKey: CustomTestValue");
      expect(projectYml).toContain("NSAppleEventsUsageDescription:");
    });

    it("contains Generated by header comment", () => {
      expect(projectYml).toContain("Generated by tauri-macos-xcode");
    });
  });

  describe("Entitlements file", () => {
    let entitlementsPath: string;
    let entitlementsContent: string;

    beforeAll(() => {
      entitlementsPath = path.join(
        macosDir,
        "IntegrationTestApp_macOS",
        "IntegrationTestApp_macOS.entitlements",
      );
      if (fs.existsSync(entitlementsPath)) {
        entitlementsContent = fs.readFileSync(entitlementsPath, "utf8");
      }
    });

    it("creates entitlements file", () => {
      expect(fs.existsSync(entitlementsPath)).toBe(true);
    });

    it("contains app-sandbox set to false", () => {
      expect(entitlementsContent).toContain(
        "<key>com.apple.security.app-sandbox</key>",
      );
      expect(entitlementsContent).toContain("<false/>");
    });

    it("contains network.client entitlement", () => {
      expect(entitlementsContent).toContain(
        "<key>com.apple.security.network.client</key>",
      );
    });

    it("contains files.user-selected.read-write entitlement", () => {
      expect(entitlementsContent).toContain(
        "<key>com.apple.security.files.user-selected.read-write</key>",
      );
    });
  });

  describe("Build scripts", () => {
    it("creates build-rust.sh with correct permissions", () => {
      const scriptPath = path.join(macosDir, "scripts", "build-rust.sh");
      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      const mode = stats.mode & 0o777;
      expect(mode & 0o111).toBeGreaterThan(0); // executable
    });

    it("creates build.swift with correct permissions", () => {
      const scriptPath = path.join(macosDir, "scripts", "build.swift");
      expect(fs.existsSync(scriptPath)).toBe(true);

      const stats = fs.statSync(scriptPath);
      const mode = stats.mode & 0o777;
      expect(mode & 0o111).toBeGreaterThan(0); // executable
    });

    it("build scripts contain Generated by header", () => {
      const shScript = fs.readFileSync(
        path.join(macosDir, "scripts", "build-rust.sh"),
        "utf8",
      );
      const swiftScript = fs.readFileSync(
        path.join(macosDir, "scripts", "build.swift"),
        "utf8",
      );

      expect(shScript).toContain("Generated by tauri-macos-xcode");
      expect(swiftScript).toContain("Generated by tauri-macos-xcode");
    });
  });

  describe("Icon assets", () => {
    // Icon filenames match macOS requirements: size@scale format
    const iconFiles = [
      "icon_16x16.png",
      "icon_16x16@2x.png",
      "icon_32x32.png",
      "icon_32x32@2x.png",
      "icon_128x128.png",
      "icon_128x128@2x.png",
      "icon_256x256.png",
      "icon_256x256@2x.png",
      "icon_512x512.png",
      "icon_512x512@2x.png",
    ];

    it("creates AppIcon.appiconset directory", () => {
      const appiconsetPath = path.join(
        macosDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
      );
      expect(fs.existsSync(appiconsetPath)).toBe(true);
    });

    it("creates Contents.json with correct image references", () => {
      const contentsJsonPath = path.join(
        macosDir,
        "Assets.xcassets",
        "AppIcon.appiconset",
        "Contents.json",
      );
      expect(fs.existsSync(contentsJsonPath)).toBe(true);

      const contents = JSON.parse(fs.readFileSync(contentsJsonPath, "utf8"));
      expect(contents.images).toBeDefined();
      expect(Array.isArray(contents.images)).toBe(true);
      expect(contents.images.length).toBe(10); // 5 sizes x 2 scales
    });

    for (const filename of iconFiles) {
      it(`generates ${filename}`, () => {
        const iconPath = path.join(
          macosDir,
          "Assets.xcassets",
          "AppIcon.appiconset",
          filename,
        );
        expect(fs.existsSync(iconPath)).toBe(true);
      });
    }
  });

  describe("Podfile", () => {
    let podfileContent: string;

    beforeAll(() => {
      podfileContent = fs.readFileSync(path.join(macosDir, "Podfile"), "utf8");
    });

    it("creates Podfile", () => {
      expect(fs.existsSync(path.join(macosDir, "Podfile"))).toBe(true);
    });

    it("contains correct target name", () => {
      expect(podfileContent).toContain("target 'IntegrationTestApp_macOS'");
    });

    it("contains correct deployment target", () => {
      expect(podfileContent).toContain("platform :osx, '13.0'");
    });

    it("contains Generated by header", () => {
      expect(podfileContent).toContain("Generated by tauri-macos-xcode");
    });
  });

  describe(".gitignore", () => {
    let gitignoreContent: string;

    beforeAll(() => {
      gitignoreContent = fs.readFileSync(
        path.join(macosDir, ".gitignore"),
        "utf8",
      );
    });

    it("creates .gitignore", () => {
      expect(fs.existsSync(path.join(macosDir, ".gitignore"))).toBe(true);
    });

    it("contains xcuserdata/", () => {
      expect(gitignoreContent).toContain("xcuserdata/");
    });

    it("contains build/", () => {
      expect(gitignoreContent).toContain("build/");
    });
  });

  describe("XcodeGen execution", { skip: !hasXcodegen }, () => {
    it("creates .xcodeproj directory", () => {
      const xcodeprojPath = path.join(macosDir, "IntegrationTestApp.xcodeproj");
      expect(fs.existsSync(xcodeprojPath)).toBe(true);
    });

    it("creates project.pbxproj", () => {
      const pbxprojPath = path.join(
        macosDir,
        "IntegrationTestApp.xcodeproj",
        "project.pbxproj",
      );
      expect(fs.existsSync(pbxprojPath)).toBe(true);
    });
  });

  describe("package.json updates", () => {
    let pkgContent: Record<string, unknown>;

    beforeAll(() => {
      pkgContent = JSON.parse(
        fs.readFileSync(path.join(testDir, "package.json"), "utf8"),
      );
    });

    it("adds tauri:macos:dev script", () => {
      const scripts = pkgContent.scripts as Record<string, string>;
      expect(scripts["tauri:macos:dev"]).toBe("tauri-macos-xcode dev --open");
    });

    it("adds devDependency", () => {
      const devDeps = pkgContent.devDependencies as Record<string, string>;
      expect(devDeps["@choochmeque/tauri-macos-xcode"]).toBeDefined();
    });
  });
});
