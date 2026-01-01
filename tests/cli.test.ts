import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// Store action handlers for testing
let initAction: ((options: unknown) => Promise<void>) | null = null;
let devAction: ((options: unknown) => Promise<void>) | null = null;
let currentCommandName: string | null = null;

// Mock commander before importing cli
vi.mock("commander", () => {
  const createMockCommand = (): Record<string, unknown> => {
    const mock: Record<string, unknown> = {};

    mock.name = vi.fn(() => mock);
    mock.description = vi.fn(() => mock);
    mock.version = vi.fn(() => mock);
    mock.option = vi.fn(() => mock);
    mock.parse = vi.fn(() => mock);

    mock.command = vi.fn((name: string) => {
      currentCommandName = name;
      return mock;
    });

    mock.action = vi.fn((handler: (options: unknown) => Promise<void>) => {
      if (currentCommandName === "init") {
        initAction = handler;
      } else if (currentCommandName === "dev") {
        devAction = handler;
      }
      return mock;
    });

    return mock;
  };

  return {
    Command: vi.fn(() => createMockCommand()),
  };
});

// Mock the commands
vi.mock("../src/commands/init.js", () => ({
  init: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/commands/dev.js", () => ({
  dev: vi.fn().mockResolvedValue(undefined),
}));

describe("cli", () => {
  beforeEach(async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    vi.spyOn(process, "exit").mockImplementation(() => {
      throw new Error("process.exit called");
    });

    // Reset action handlers
    initAction = null;
    devAction = null;

    // Clear module cache and reimport to trigger setup
    vi.resetModules();

    // Import cli to trigger the setup
    await import("../src/cli.js");
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("registers init command", async () => {
    expect(initAction).toBeDefined();
  });

  it("registers dev command", async () => {
    expect(devAction).toBeDefined();
  });

  it("init action calls init command", async () => {
    const { init } = await import("../src/commands/init.js");

    await initAction!({ path: "/test" });

    expect(init).toHaveBeenCalledWith({ path: "/test" });
  });

  it("dev action calls dev command", async () => {
    const { dev } = await import("../src/commands/dev.js");

    await devAction!({ open: true });

    expect(dev).toHaveBeenCalledWith({ open: true });
  });

  it("init action handles errors", async () => {
    const { init } = await import("../src/commands/init.js");
    vi.mocked(init).mockRejectedValueOnce(new Error("Test error"));

    const consoleSpy = vi.spyOn(console, "error");

    await expect(initAction!({})).rejects.toThrow("process.exit called");

    expect(consoleSpy).toHaveBeenCalledWith("Error:", "Test error");
  });

  it("dev action handles errors", async () => {
    const { dev } = await import("../src/commands/dev.js");
    vi.mocked(dev).mockRejectedValueOnce(new Error("Dev error"));

    const consoleSpy = vi.spyOn(console, "error");

    await expect(devAction!({})).rejects.toThrow("process.exit called");

    expect(consoleSpy).toHaveBeenCalledWith("Error:", "Dev error");
  });
});
