import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import { init } from "../../src/commands/init.js";

// Mock xcodegen to prevent actual execution
vi.mock("../../src/core/xcodegen.js", () => ({
  runXcodeGen: vi.fn().mockResolvedValue(undefined),
}));

describe("init command", () => {
  let tempDir: string;

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-init-test-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
    vi.restoreAllMocks();
  });

  function createTauriProject(dir: string, config: object = {}) {
    // Create src-tauri directory with tauri.conf.json
    const srcTauriDir = path.join(dir, "src-tauri");
    fs.mkdirSync(srcTauriDir, { recursive: true });

    const defaultConfig = {
      productName: "TestApp",
      identifier: "com.test.app",
      version: "1.0.0",
      build: {
        beforeDevCommand: "npm run dev",
      },
      ...config,
    };

    fs.writeFileSync(
      path.join(srcTauriDir, "tauri.conf.json"),
      JSON.stringify(defaultConfig, null, 2),
    );

    // Create package.json
    fs.writeFileSync(
      path.join(dir, "package.json"),
      JSON.stringify({ name: "test-app", scripts: {} }, null, 2),
    );

    return dir;
  }

  it("creates macOS directory structure", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const macosDir = path.join(tempDir, "src-tauri", "gen", "apple-macos");
    expect(fs.existsSync(macosDir)).toBe(true);
    expect(fs.existsSync(path.join(macosDir, "TestApp_macOS"))).toBe(true);
    expect(fs.existsSync(path.join(macosDir, "scripts"))).toBe(true);
  });

  it("generates project.yml", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const projectYml = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      "project.yml",
    );
    expect(fs.existsSync(projectYml)).toBe(true);
    const content = fs.readFileSync(projectYml, "utf8");
    expect(content).toContain("TestApp");
  });

  it("generates Info.plist", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const plistPath = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      "TestApp_macOS",
      "Info.plist",
    );
    expect(fs.existsSync(plistPath)).toBe(true);
  });

  it("generates entitlements file", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const entitlementsPath = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      "TestApp_macOS",
      "TestApp_macOS.entitlements",
    );
    expect(fs.existsSync(entitlementsPath)).toBe(true);
  });

  it("generates build script", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const scriptPath = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      "scripts",
      "build-rust.sh",
    );
    expect(fs.existsSync(scriptPath)).toBe(true);
  });

  it("generates Podfile", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const podfilePath = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      "Podfile",
    );
    expect(fs.existsSync(podfilePath)).toBe(true);
  });

  it("creates .gitignore", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const gitignorePath = path.join(
      tempDir,
      "src-tauri",
      "gen",
      "apple-macos",
      ".gitignore",
    );
    expect(fs.existsSync(gitignorePath)).toBe(true);
    const content = fs.readFileSync(gitignorePath, "utf8");
    expect(content).toContain("xcuserdata/");
    expect(content).toContain(".xcodeproj/");
  });

  it("updates package.json with script", async () => {
    createTauriProject(tempDir);

    await init({ path: tempDir });

    const pkgPath = path.join(tempDir, "package.json");
    const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf8"));
    expect(pkg.scripts["tauri:macos:dev"]).toBe("tauri-macos-xcode dev --open");
    expect(pkg.devDependencies["@choochmeque/tauri-macos-xcode"]).toBe(
      "^0.1.0",
    );
  });

  it("does not overwrite existing tauri:macos:dev script", async () => {
    const srcTauriDir = path.join(tempDir, "src-tauri");
    fs.mkdirSync(srcTauriDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcTauriDir, "tauri.conf.json"),
      JSON.stringify({ productName: "TestApp" }),
    );
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({
        name: "test",
        scripts: { "tauri:macos:dev": "custom command" },
      }),
    );

    await init({ path: tempDir });

    const pkg = JSON.parse(
      fs.readFileSync(path.join(tempDir, "package.json"), "utf8"),
    );
    expect(pkg.scripts["tauri:macos:dev"]).toBe("custom command");
  });

  it("uses default values when config is minimal", async () => {
    const srcTauriDir = path.join(tempDir, "src-tauri");
    fs.mkdirSync(srcTauriDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcTauriDir, "tauri.conf.json"),
      JSON.stringify({}),
    );
    fs.writeFileSync(
      path.join(tempDir, "package.json"),
      JSON.stringify({ name: "test" }),
    );

    await init({ path: tempDir });

    // Should use default product name "TauriApp"
    const macosDir = path.join(tempDir, "src-tauri", "gen", "apple-macos");
    expect(fs.existsSync(path.join(macosDir, "TauriApp_macOS"))).toBe(true);
  });

  it("finds project root when path not provided", async () => {
    createTauriProject(tempDir);

    const originalCwd = process.cwd();
    process.chdir(tempDir);

    try {
      await init({});

      const macosDir = path.join(tempDir, "src-tauri", "gen", "apple-macos");
      expect(fs.existsSync(macosDir)).toBe(true);
    } finally {
      process.chdir(originalCwd);
    }
  });
});
