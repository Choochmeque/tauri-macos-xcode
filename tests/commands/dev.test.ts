import {
  describe,
  it,
  expect,
  vi,
  beforeEach,
  afterEach,
  type MockInstance,
} from "vitest";
import fs from "fs";
import path from "path";
import os from "os";
import * as childProcess from "child_process";
import { dev } from "../../src/commands/dev.js";

// Mock child_process.spawn
vi.mock("child_process", async () => {
  const actual = await vi.importActual("child_process");
  return {
    ...actual,
    spawn: vi.fn().mockReturnValue({
      kill: vi.fn(),
      on: vi.fn(),
    }),
  };
});

describe("dev command", () => {
  let tempDir: string;
  let mockExit: MockInstance;
  const originalListeners: {
    SIGINT: ((signal: NodeJS.Signals) => void)[];
    SIGTERM: ((signal: NodeJS.Signals) => void)[];
  } = { SIGINT: [], SIGTERM: [] };

  beforeEach(() => {
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "tauri-dev-test-"));
    vi.spyOn(console, "log").mockImplementation(() => {});
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockExit = vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Store original listeners
    originalListeners.SIGINT = process.listeners("SIGINT") as ((
      signal: NodeJS.Signals,
    ) => void)[];
    originalListeners.SIGTERM = process.listeners("SIGTERM") as ((
      signal: NodeJS.Signals,
    ) => void)[];
  });

  afterEach(() => {
    fs.rmSync(tempDir, { recursive: true });
    vi.restoreAllMocks();

    // Remove any listeners added during test and restore originals
    process.removeAllListeners("SIGINT");
    process.removeAllListeners("SIGTERM");
    originalListeners.SIGINT.forEach((l) => process.on("SIGINT", l));
    originalListeners.SIGTERM.forEach((l) => process.on("SIGTERM", l));
  });

  function createTauriProject(
    dir: string,
    config: object = {},
    withMacosProject = true,
  ) {
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

    if (withMacosProject) {
      const macosDir = path.join(srcTauriDir, "gen", "apple-macos");
      fs.mkdirSync(macosDir, { recursive: true });
      fs.writeFileSync(path.join(macosDir, "project.yml"), "name: TestApp");
      fs.writeFileSync(path.join(macosDir, "TestApp.xcodeproj"), "");
    }

    return dir;
  }

  it("exits with error if project.yml not found", async () => {
    createTauriProject(tempDir, {}, false);

    await expect(dev({ path: tempDir })).rejects.toThrow("process.exit called");
    expect(mockExit).toHaveBeenCalledWith(1);
  });

  it("spawns dev server when beforeDevCommand is set", async () => {
    createTauriProject(tempDir);
    const mockSpawn = vi.mocked(childProcess.spawn);

    // Don't await since it hangs forever when dev command is present
    dev({ path: tempDir, open: false });

    // Give it a tick to start
    await new Promise((r) => setTimeout(r, 10));

    expect(mockSpawn).toHaveBeenCalledWith(
      "npm run dev",
      [],
      expect.objectContaining({
        shell: true,
        cwd: tempDir,
        stdio: "inherit",
      }),
    );

    // Clean up - the promise never resolves so we just move on
  });

  it("opens Xcode project when --open is set", async () => {
    createTauriProject(tempDir, { build: {} }); // No beforeDevCommand so it doesn't hang
    const mockSpawn = vi.mocked(childProcess.spawn);

    await dev({ path: tempDir, open: true });

    expect(mockSpawn).toHaveBeenCalledWith(
      "open",
      [expect.stringContaining("TestApp.xcodeproj")],
      expect.objectContaining({ stdio: "inherit" }),
    );
  });

  it("logs error when xcodeproj not found and --open is set", async () => {
    const srcTauriDir = path.join(tempDir, "src-tauri");
    fs.mkdirSync(srcTauriDir, { recursive: true });
    fs.writeFileSync(
      path.join(srcTauriDir, "tauri.conf.json"),
      JSON.stringify({ productName: "TestApp", build: {} }),
    );

    const macosDir = path.join(srcTauriDir, "gen", "apple-macos");
    fs.mkdirSync(macosDir, { recursive: true });
    fs.writeFileSync(path.join(macosDir, "project.yml"), "name: TestApp");
    // No .xcodeproj file

    const consoleSpy = vi.spyOn(console, "error");

    await dev({ path: tempDir, open: true });

    expect(consoleSpy).toHaveBeenCalledWith(
      "Xcode project not found. Try running xcodegen manually in:",
      expect.any(String),
    );
  });

  it("does not spawn dev server when beforeDevCommand is not set", async () => {
    createTauriProject(tempDir, { build: {} });
    const mockSpawn = vi.mocked(childProcess.spawn);
    mockSpawn.mockClear();

    await dev({ path: tempDir, open: false });

    // spawn should not be called for dev server (only potentially for open)
    expect(mockSpawn).not.toHaveBeenCalledWith(
      expect.any(String),
      [],
      expect.objectContaining({ shell: true }),
    );
  });

  it("SIGINT handler kills child process", async () => {
    createTauriProject(tempDir);
    const mockKill = vi.fn();
    const mockSpawn = vi.mocked(childProcess.spawn);
    mockSpawn.mockReturnValue({
      kill: mockKill,
      on: vi.fn(),
    } as unknown as ReturnType<typeof childProcess.spawn>);

    // Start dev (don't await - it runs forever)
    dev({ path: tempDir, open: false });

    // Wait for handlers to be registered
    await new Promise((r) => setTimeout(r, 10));

    // Get the SIGINT listeners that were added
    const sigintListeners = process.listeners("SIGINT");
    const addedListener = sigintListeners.find(
      (l) =>
        !originalListeners.SIGINT.includes(
          l as (signal: NodeJS.Signals) => void,
        ),
    );

    expect(addedListener).toBeDefined();

    // Trigger the handler (wrapped to catch process.exit)
    try {
      (addedListener as () => void)();
    } catch {
      // Expected: process.exit throws in our mock
    }

    expect(mockKill).toHaveBeenCalled();
  });

  it("SIGTERM handler kills child process", async () => {
    createTauriProject(tempDir);
    const mockKill = vi.fn();
    const mockSpawn = vi.mocked(childProcess.spawn);
    mockSpawn.mockReturnValue({
      kill: mockKill,
      on: vi.fn(),
    } as unknown as ReturnType<typeof childProcess.spawn>);

    // Start dev (don't await - it runs forever)
    dev({ path: tempDir, open: false });

    // Wait for handlers to be registered
    await new Promise((r) => setTimeout(r, 10));

    // Get the SIGTERM listeners that were added
    const sigtermListeners = process.listeners("SIGTERM");
    const addedListener = sigtermListeners.find(
      (l) =>
        !originalListeners.SIGTERM.includes(
          l as (signal: NodeJS.Signals) => void,
        ),
    );

    expect(addedListener).toBeDefined();

    // Trigger the handler (wrapped to catch process.exit)
    try {
      (addedListener as () => void)();
    } catch {
      // Expected: process.exit throws in our mock
    }

    expect(mockKill).toHaveBeenCalled();
  });
});
