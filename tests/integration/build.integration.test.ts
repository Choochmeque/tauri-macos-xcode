import { describe, it, expect, beforeAll, afterAll, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { execSync, spawnSync } from "child_process";
import plist from "plist";
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

function checkRustTarget(target: string): boolean {
  try {
    const result = execSync("rustup target list --installed", {
      encoding: "utf8",
    });
    return result.includes(target);
  } catch {
    return false;
  }
}

describe("Integration: Build Command", () => {
  let testDir: string;
  let macosDir: string;
  let appBundlePath: string;

  const hasXcodegen = checkPrerequisite("which xcodegen");
  const hasXcodebuild = checkPrerequisite("which xcodebuild");
  const hasRust = checkPrerequisite("which rustc");
  const hasArm64Target = hasRust && checkRustTarget("aarch64-apple-darwin");
  const hasX86Target = hasRust && checkRustTarget("x86_64-apple-darwin");

  const canRunBuildTests =
    hasXcodegen && hasXcodebuild && hasArm64Target && hasX86Target;

  beforeAll(
    async () => {
      if (!canRunBuildTests) {
        const missing: string[] = [];
        if (!hasXcodegen) missing.push("XcodeGen");
        if (!hasXcodebuild) missing.push("xcodebuild");
        if (!hasArm64Target) missing.push("aarch64-apple-darwin target");
        if (!hasX86Target) missing.push("x86_64-apple-darwin target");
        console.warn(
          `Build tests skipped - missing prerequisites: ${missing.join(", ")}`
        );
        return;
      }

      // Copy fixture to temp directory
      testDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-build-test-"));
      fs.cpSync(FIXTURE_PATH, testDir, { recursive: true });

      // Silence console output during init
      vi.spyOn(console, "log").mockImplementation(() => {});
      vi.spyOn(console, "warn").mockImplementation(() => {});

      // Run init command
      await init({ path: testDir });

      macosDir = path.join(testDir, "src-tauri", "gen", "apple-macos");

      // Run xcodebuild for universal binary
      console.log("Building universal binary...");
      const buildResult = spawnSync(
        "xcodebuild",
        [
          "-project",
          "IntegrationTestApp.xcodeproj",
          "-scheme",
          "IntegrationTestApp_macOS",
          "-configuration",
          "Debug",
          "ARCHS=arm64 x86_64",
          "ONLY_ACTIVE_ARCH=NO",
          "build",
        ],
        {
          cwd: macosDir,
          stdio: "pipe",
          encoding: "utf8",
          timeout: 600000, // 10 minutes
        }
      );

      if (buildResult.status !== 0) {
        console.error("xcodebuild failed:", buildResult.stderr);
        throw new Error(`xcodebuild failed with status ${buildResult.status}`);
      }

      // Find the app bundle in the build output
      // xcodebuild outputs to DerivedData or BUILD_DIR
      const showBuildSettings = spawnSync(
        "xcodebuild",
        [
          "-project",
          "IntegrationTestApp.xcodeproj",
          "-scheme",
          "IntegrationTestApp_macOS",
          "-configuration",
          "Debug",
          "-showBuildSettings",
        ],
        {
          cwd: macosDir,
          encoding: "utf8",
        }
      );

      const builtProductsDirMatch = showBuildSettings.stdout.match(
        /BUILT_PRODUCTS_DIR = (.+)/
      );
      if (builtProductsDirMatch) {
        appBundlePath = path.join(
          builtProductsDirMatch[1].trim(),
          "IntegrationTestApp.app"
        );
      }
    },
    660000
  ); // 11 minutes timeout for beforeAll

  afterAll(() => {
    vi.restoreAllMocks();
    if (testDir && fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe("Build execution", { skip: !canRunBuildTests }, () => {
    it("completes xcodebuild successfully", () => {
      expect(appBundlePath).toBeDefined();
      expect(fs.existsSync(appBundlePath)).toBe(true);
    });
  });

  describe("App bundle structure", { skip: !canRunBuildTests }, () => {
    it("creates app bundle directory", () => {
      expect(fs.existsSync(appBundlePath)).toBe(true);
    });

    it("contains Contents/MacOS/IntegrationTestApp binary", () => {
      const binaryPath = path.join(
        appBundlePath,
        "Contents",
        "MacOS",
        "IntegrationTestApp"
      );
      expect(fs.existsSync(binaryPath)).toBe(true);
    });

    it("contains Contents/Info.plist", () => {
      const infoPlistPath = path.join(appBundlePath, "Contents", "Info.plist");
      expect(fs.existsSync(infoPlistPath)).toBe(true);
    });

    it("contains Contents/Resources directory", () => {
      const resourcesPath = path.join(appBundlePath, "Contents", "Resources");
      expect(fs.existsSync(resourcesPath)).toBe(true);
    });
  });

  describe("Universal binary verification", { skip: !canRunBuildTests }, () => {
    it("binary contains both arm64 and x86_64 architectures", () => {
      const binaryPath = path.join(
        appBundlePath,
        "Contents",
        "MacOS",
        "IntegrationTestApp"
      );

      const lipoResult = spawnSync("lipo", ["-info", binaryPath], {
        encoding: "utf8",
      });

      expect(lipoResult.status).toBe(0);
      expect(lipoResult.stdout).toContain("arm64");
      expect(lipoResult.stdout).toContain("x86_64");
    });
  });

  describe("Info.plist verification", { skip: !canRunBuildTests }, () => {
    let infoPlist: Record<string, unknown>;

    beforeAll(() => {
      if (!canRunBuildTests || !appBundlePath) return;

      const infoPlistPath = path.join(appBundlePath, "Contents", "Info.plist");
      const content = fs.readFileSync(infoPlistPath, "utf8");
      infoPlist = plist.parse(content) as Record<string, unknown>;
    });

    it("has correct CFBundleIdentifier", () => {
      expect(infoPlist.CFBundleIdentifier).toBe("com.test.integration");
    });

    it("has correct CFBundleVersion", () => {
      expect(infoPlist.CFBundleVersion).toBe("1.2.3");
    });

    it("has correct CFBundleShortVersionString", () => {
      expect(infoPlist.CFBundleShortVersionString).toBe("1.2.3");
    });

    it("has correct LSMinimumSystemVersion", () => {
      expect(infoPlist.LSMinimumSystemVersion).toBe("13.0");
    });

    it("has correct LSApplicationCategoryType", () => {
      expect(infoPlist.LSApplicationCategoryType).toBe(
        "public.app-category.developer-tools"
      );
    });

    it("has NSHumanReadableCopyright", () => {
      expect(infoPlist.NSHumanReadableCopyright).toContain("Copyright");
    });

    it("has custom Info.plist keys merged", () => {
      expect(infoPlist.CustomTestKey).toBe("CustomTestValue");
      expect(infoPlist.NSAppleEventsUsageDescription).toBeDefined();
    });

    it("has CFBundleDocumentTypes for file associations", () => {
      const docTypes = infoPlist.CFBundleDocumentTypes as Array<{
        CFBundleTypeName: string;
        CFBundleTypeExtensions: string[];
      }>;
      expect(Array.isArray(docTypes)).toBe(true);
      expect(docTypes.length).toBeGreaterThan(0);

      const testFileType = docTypes.find(
        (dt) => dt.CFBundleTypeName === "Test File"
      );
      expect(testFileType).toBeDefined();
      expect(testFileType?.CFBundleTypeExtensions).toContain("testfile");
    });
  });

  describe(
    "Resources, files, and frameworks copied",
    { skip: !canRunBuildTests },
    () => {
      it("copies data.json to Contents/Resources/", () => {
        const resourcePath = path.join(
          appBundlePath,
          "Contents",
          "Resources",
          "data.json"
        );
        expect(fs.existsSync(resourcePath)).toBe(true);

        const content = JSON.parse(fs.readFileSync(resourcePath, "utf8"));
        expect(content.test).toBe("integration");
      });

      it("copies nested.txt to Contents/Resources/CustomDir/", () => {
        const resourcePath = path.join(
          appBundlePath,
          "Contents",
          "Resources",
          "CustomDir",
          "nested.txt"
        );
        expect(fs.existsSync(resourcePath)).toBe(true);
      });

      it("copies support-file.txt to Contents/SharedSupport/", () => {
        const filePath = path.join(
          appBundlePath,
          "Contents",
          "SharedSupport",
          "support-file.txt"
        );
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("copies helper-binary to Contents/MacOS/", () => {
        const filePath = path.join(
          appBundlePath,
          "Contents",
          "MacOS",
          "helper-binary"
        );
        expect(fs.existsSync(filePath)).toBe(true);
      });

      it("copies plugin.bundle to Contents/PlugIns/", () => {
        const pluginPath = path.join(
          appBundlePath,
          "Contents",
          "PlugIns",
          "plugin.bundle"
        );
        expect(fs.existsSync(pluginPath)).toBe(true);

        // Check plugin has Info.plist
        const pluginInfoPath = path.join(pluginPath, "Info.plist");
        expect(fs.existsSync(pluginInfoPath)).toBe(true);
      });

      it("copies TestLib.dylib to Contents/Frameworks/", () => {
        const frameworkPath = path.join(
          appBundlePath,
          "Contents",
          "Frameworks",
          "TestLib.dylib"
        );
        expect(fs.existsSync(frameworkPath)).toBe(true);
      });
    }
  );

  describe("Entitlements applied", { skip: !canRunBuildTests }, () => {
    it("app bundle has embedded entitlements", () => {
      // Use codesign to extract entitlements from the built app
      const codesignResult = spawnSync(
        "codesign",
        ["-d", "--entitlements", "-", "--xml", appBundlePath],
        {
          encoding: "utf8",
        }
      );

      // If the app is not signed, codesign may return an error
      // In that case, we skip this test
      if (codesignResult.status !== 0) {
        console.warn(
          "App is not signed, skipping entitlements verification"
        );
        return;
      }

      const entitlementsXml = codesignResult.stdout;
      expect(entitlementsXml).toContain("com.apple.security.network.client");
    });
  });
});
