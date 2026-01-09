import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { Jimp } from "jimp";
import { AppInfo } from "../../src/types.js";
import {
  generateProjectYml,
  valueToYaml,
} from "../../src/generators/project-yml.js";
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
      expect(content).toContain("- framework: ../../vendor/Sparkle.framework");
      expect(content).toContain("embed: true");
      expect(content).toContain("- framework: ../../libs/MyLib.framework");
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
        frameworks: ["libs/libmsodbcsql.18.dylib"],
      };
      generateProjectYml(tempDir, appInfoWithDylibs);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // Dylibs are now embedded as dependencies
      expect(content).toContain(
        "- framework: ../../libs/libmsodbcsql.18.dylib",
      );
      expect(content).toContain("embed: true");
    });

    it("project.yml groups multiple dylibs together", () => {
      const appInfoWithDylibs = {
        ...mockAppInfo,
        frameworks: ["libs/lib1.dylib", "libs/lib2.dylib"],
      };
      generateProjectYml(tempDir, appInfoWithDylibs);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // Dylibs are embedded as dependencies
      expect(content).toContain("- framework: ../../libs/lib1.dylib");
      expect(content).toContain("- framework: ../../libs/lib2.dylib");
      expect(content).toContain("embed: true");
    });

    it("project.yml handles mixed framework types", () => {
      const appInfoWithMixed = {
        ...mockAppInfo,
        frameworks: [
          "CoreAudio",
          "libs/libmsodbcsql.18.dylib",
          "frameworks/MyApp.framework",
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
      expect(content).toContain(
        "- framework: ../../frameworks/MyApp.framework",
      );
      expect(content).toContain("embed: true");
      // Dylib embedded as dependency
      expect(content).toContain(
        "- framework: ../../libs/libmsodbcsql.18.dylib",
      );
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
          "embedded.provisionprofile": "profile.provisionprofile",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("buildPhase:");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: wrapper");
      expect(content).toContain("path: ../../profile.provisionprofile");
    });

    it("project.yml copies file to sharedSupport for SharedSupport/ destination", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/docs.md": "docs/index.md",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("buildPhase:");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("path: ../../docs/index.md");
    });

    it("project.yml uses subpath for nested destinations", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/data/config.json": "config.json",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("subpath: data");
      expect(content).toContain("path: ../../config.json");
    });

    it("project.yml uses wrapper with subpath for unknown directories", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "CustomFolder/nested/file.txt": "source.txt",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: wrapper");
      expect(content).toContain("subpath: CustomFolder/nested");
      expect(content).toContain("path: ../../source.txt");
    });

    it("project.yml groups multiple files with same destination", () => {
      const appInfoWithFiles = {
        ...mockAppInfo,
        files: {
          "SharedSupport/file1.txt": "src/file1.txt",
          "SharedSupport/file2.txt": "src/file2.txt",
        },
      };
      generateProjectYml(tempDir, appInfoWithFiles);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: sharedSupport");
      expect(content).toContain("path: ../../src/file1.txt");
      expect(content).toContain("path: ../../src/file2.txt");
    });

    it("project.yml omits copyFiles when files not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("copyFiles:");
    });

    it("project.yml embeds executables with code signing for MacOS/ destination", () => {
      const appInfoWithExecutable = {
        ...mockAppInfo,
        files: {
          "MacOS/helper-binary": "files/helper-binary",
        },
      };
      generateProjectYml(tempDir, appInfoWithExecutable);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // Executables should be embedded as dependencies with code signing
      expect(content).toContain("- framework: ../../files/helper-binary");
      expect(content).toContain("embed: true");
      expect(content).toContain("codeSign: true");
      expect(content).toContain("destination: executables");
      // Should NOT be in copyFiles section
      expect(content).not.toMatch(/copyFiles:[\s\S]*helper-binary/);
    });

    it("project.yml embeds plugins with code signing for PlugIns/ destination", () => {
      const appInfoWithPlugin = {
        ...mockAppInfo,
        files: {
          "PlugIns/my-plugin.bundle": "plugins/my-plugin.bundle",
        },
      };
      generateProjectYml(tempDir, appInfoWithPlugin);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // Plugins should be embedded as dependencies with code signing
      expect(content).toContain("- framework: ../../plugins/my-plugin.bundle");
      expect(content).toContain("embed: true");
      expect(content).toContain("codeSign: true");
      expect(content).toContain("destination: plugins");
    });

    it("project.yml handles mixed executables, plugins, and regular files", () => {
      const appInfoWithMixed = {
        ...mockAppInfo,
        files: {
          "MacOS/helper": "bin/helper",
          "PlugIns/plugin.bundle": "plugins/plugin.bundle",
          "SharedSupport/data.txt": "data/data.txt",
        },
      };
      generateProjectYml(tempDir, appInfoWithMixed);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      // Executables and plugins should be embedded as dependencies
      expect(content).toContain("- framework: ../../bin/helper");
      expect(content).toContain("- framework: ../../plugins/plugin.bundle");
      expect(content).toContain("codeSign: true");
      // Regular files should use copyFiles
      expect(content).toContain("path: ../../data/data.txt");
      expect(content).toContain("destination: sharedSupport");
    });

    it("project.yml includes both frameworks and files when specified", () => {
      const appInfoWithBoth = {
        ...mockAppInfo,
        frameworks: ["vendor/Sparkle.framework"],
        files: {
          "Resources/config.json": "assets/config.json",
        },
      };
      generateProjectYml(tempDir, appInfoWithBoth);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("- framework: ../../vendor/Sparkle.framework");
      expect(content).toContain("embed: true");
      expect(content).toContain("buildPhase:");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: resources");
      expect(content).toContain("path: ../../assets/config.json");
    });

    it("project.yml copies resources to Resources directory", () => {
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [
          { source: "assets/data.json", target: "" },
          { source: "config/settings.json", target: "" },
        ],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("buildPhase:");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: resources");
      expect(content).toContain("path: ../../assets/data.json");
      expect(content).toContain("path: ../../config/settings.json");
    });

    it("project.yml copies resources with subpath when target specified", () => {
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [{ source: "data/config.json", target: "configs" }],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("buildPhase:");
      expect(content).toContain("copyFiles:");
      expect(content).toContain("destination: resources");
      expect(content).toContain("subpath: configs");
      expect(content).toContain("path: ../../data/config.json");
    });

    it("project.yml groups resources with same target", () => {
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [
          { source: "file1.json", target: "data" },
          { source: "file2.json", target: "data" },
        ],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: resources");
      expect(content).toContain("subpath: data");
      expect(content).toContain("path: ../../file1.json");
      expect(content).toContain("path: ../../file2.json");
    });

    it("project.yml omits resources subpath for empty target", () => {
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [{ source: "data.json", target: "" }],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: resources");
      expect(content).toContain("path: ../../data.json");
      // Check that there's no subpath for this entry
      expect(content).not.toMatch(/subpath:.*\n.*path: \.\.\/\.\.\/data\.json/);
    });

    it("project.yml omits subpath when target is filename with extension", () => {
      // When target is like "renamed.json" (has extension, no slash),
      // it means put the file in Resources root with that name
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [
          { source: "config/settings.json", target: "app-config.json" },
        ],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: resources");
      expect(content).toContain("path: ../../config/settings.json");
      // When target has extension but no slash, it's a filename - no subpath
      expect(content).not.toMatch(/subpath: app-config/);
    });

    it("project.yml extracts directory from nested target path", () => {
      // When target is like "configs/nested/file.json", extract "configs/nested" as subpath
      const appInfoWithResources = {
        ...mockAppInfo,
        resources: [
          { source: "data.json", target: "configs/nested/renamed.json" },
        ],
      };
      generateProjectYml(tempDir, appInfoWithResources);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("destination: resources");
      expect(content).toContain("subpath: configs/nested");
      expect(content).toContain("path: ../../data.json");
    });

    it("project.yml includes CFBundleDocumentTypes for fileAssociations", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["myext"],
            name: "My File Type",
            role: "Editor" as const,
            rank: "Owner" as const,
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("CFBundleDocumentTypes:");
      expect(content).toContain("CFBundleTypeName: My File Type");
      expect(content).toContain("CFBundleTypeRole: Editor");
      expect(content).toContain("CFBundleTypeExtensions:");
      expect(content).toContain("- myext");
      expect(content).toContain("LSHandlerRank: Owner");
    });

    it("project.yml includes LSItemContentTypes when specified", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["myext"],
            contentTypes: ["com.example.myext"],
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("LSItemContentTypes:");
      expect(content).toContain("- com.example.myext");
    });

    it("project.yml includes UTExportedTypeDeclarations for exportedType", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["myext"],
            exportedType: {
              identifier: "com.example.myext",
              conformsTo: ["public.data"],
            },
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("UTExportedTypeDeclarations:");
      expect(content).toContain("UTTypeIdentifier: com.example.myext");
      expect(content).toContain("UTTypeConformsTo:");
      expect(content).toContain("- public.data");
      expect(content).toContain("UTTypeTagSpecification:");
      expect(content).toContain("public.filename-extension:");
    });

    it("project.yml uses default role and rank for fileAssociations", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["abc"],
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("CFBundleTypeName: abc");
      expect(content).toContain("CFBundleTypeRole: Editor");
      expect(content).toContain("LSHandlerRank: Default");
    });

    it("project.yml omits UTExportedTypeDeclarations when no exportedType", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["txt"],
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("CFBundleDocumentTypes:");
      expect(content).not.toContain("UTExportedTypeDeclarations:");
    });

    it("project.yml omits fileAssociations when not specified", () => {
      generateProjectYml(tempDir, mockAppInfo);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).not.toContain("CFBundleDocumentTypes:");
    });

    it("project.yml handles exportedType without conformsTo", () => {
      const appInfoWithFileAssoc = {
        ...mockAppInfo,
        fileAssociations: [
          {
            ext: ["myext"],
            exportedType: {
              identifier: "com.example.myext",
            },
          },
        ],
      };
      generateProjectYml(tempDir, appInfoWithFileAssoc);
      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("UTTypeIdentifier: com.example.myext");
      expect(content).not.toContain("UTTypeConformsTo:");
    });

    it("project.yml merges custom infoPlist properties", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>LSMinimumSystemVersionByArchitecture</key>
    <dict>
        <key>arm64</key>
        <string>11.0</string>
    </dict>
    <key>NSMicrophoneUsageDescription</key>
    <string>Required for audio input</string>
</dict>
</plist>`;
      fs.writeFileSync(path.join(srcTauri, "Info.plist"), plistContent);

      const appInfo = { ...mockAppInfo, infoPlist: "Info.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("NSMicrophoneUsageDescription");
      expect(content).toContain("Required for audio input");
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml warns when custom infoPlist not found", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      fs.mkdirSync(path.join(projectRoot, "src-tauri"), { recursive: true });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const appInfo = { ...mockAppInfo, infoPlist: "missing.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Custom Info.plist file not found"),
      );
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml warns when custom infoPlist cannot be parsed", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      fs.writeFileSync(path.join(srcTauri, "invalid.plist"), "not valid plist");
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const appInfo = { ...mockAppInfo, infoPlist: "invalid.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not parse Info.plist"),
      );
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml handles infoPlist with arrays and booleans", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>LSArchitecturePriority</key>
    <array>
        <string>arm64</string>
        <string>x86_64</string>
    </array>
    <key>NSSupportsAutomaticTermination</key>
    <true/>
    <key>NSSupportsSuddenTermination</key>
    <false/>
    <key>BuildNumber</key>
    <integer>42</integer>
</dict>
</plist>`;
      fs.writeFileSync(path.join(srcTauri, "Info.plist"), plistContent);

      const appInfo = { ...mockAppInfo, infoPlist: "Info.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("LSArchitecturePriority:");
      expect(content).toContain("arm64");
      expect(content).toContain("x86_64");
      expect(content).toContain("NSSupportsAutomaticTermination: true");
      expect(content).toContain("NSSupportsSuddenTermination: false");
      expect(content).toContain("BuildNumber: 42");
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml handles infoPlist with special characters in strings", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>CFBundleGetInfoString</key>
    <string>Version: 1.0 # Build 42</string>
</dict>
</plist>`;
      fs.writeFileSync(path.join(srcTauri, "Info.plist"), plistContent);

      const appInfo = { ...mockAppInfo, infoPlist: "Info.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("CFBundleGetInfoString:");
      expect(content).toContain('"Version: 1.0 # Build 42"');
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml handles infoPlist with empty dict and array", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>EmptyArray</key>
    <array/>
    <key>EmptyDict</key>
    <dict/>
</dict>
</plist>`;
      fs.writeFileSync(path.join(srcTauri, "Info.plist"), plistContent);

      const appInfo = { ...mockAppInfo, infoPlist: "Info.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      const content = fs.readFileSync(
        path.join(tempDir, "project.yml"),
        "utf8",
      );
      expect(content).toContain("EmptyArray: []");
      expect(content).toContain("EmptyDict: {}");
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("project.yml ignores infoPlist with array root instead of dict", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const plistContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<array>
    <string>item1</string>
    <string>item2</string>
</array>
</plist>`;
      fs.writeFileSync(path.join(srcTauri, "array.plist"), plistContent);
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const appInfo = { ...mockAppInfo, infoPlist: "array.plist" };
      generateProjectYml(tempDir, appInfo, projectRoot);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Could not parse Info.plist"),
      );
      fs.rmSync(projectRoot, { recursive: true });
    });
  });

  describe("valueToYaml", () => {
    it("returns ~ for null", () => {
      expect(valueToYaml(null, 0)).toBe("~");
    });

    it("returns ~ for undefined", () => {
      expect(valueToYaml(undefined, 0)).toBe("~");
    });

    it("converts unknown types using String()", () => {
      const sym = Symbol("test");
      expect(valueToYaml(sym, 0)).toBe("Symbol(test)");
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

    it("uses custom entitlements file when specified", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      const srcTauri = path.join(projectRoot, "src-tauri");
      fs.mkdirSync(srcTauri, { recursive: true });
      const customContent = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
    <key>com.apple.security.custom</key>
    <true/>
</dict>
</plist>`;
      fs.writeFileSync(
        path.join(srcTauri, "custom.entitlements"),
        customContent,
      );

      const appInfo = { ...mockAppInfo, entitlements: "custom.entitlements" };
      generateEntitlements(tempDir, appInfo, projectRoot);

      const content = fs.readFileSync(
        path.join(tempDir, "TestApp_macOS", "TestApp_macOS.entitlements"),
        "utf8",
      );
      expect(content).toContain("com.apple.security.custom");
      fs.rmSync(projectRoot, { recursive: true });
    });

    it("falls back to template when custom entitlements file not found", () => {
      const projectRoot = fs.mkdtempSync(
        path.join(os.tmpdir(), "tauri-project-"),
      );
      fs.mkdirSync(path.join(projectRoot, "src-tauri"), { recursive: true });
      const warnSpy = vi.spyOn(console, "warn").mockImplementation(() => {});

      const appInfo = { ...mockAppInfo, entitlements: "missing.entitlements" };
      generateEntitlements(tempDir, appInfo, projectRoot);

      expect(warnSpy).toHaveBeenCalledWith(
        expect.stringContaining("Custom entitlements file not found"),
      );
      const content = fs.readFileSync(
        path.join(tempDir, "TestApp_macOS", "TestApp_macOS.entitlements"),
        "utf8",
      );
      expect(content).toContain("<?xml");
      fs.rmSync(projectRoot, { recursive: true });
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
