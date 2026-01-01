import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { runXcodeGen } from "../../src/core/xcodegen.js";
import * as childProcess from "child_process";

vi.mock("child_process", () => ({
  execSync: vi.fn(),
}));

describe("xcodegen", () => {
  beforeEach(() => {
    vi.spyOn(console, "log").mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  describe("runXcodeGen", () => {
    it("runs xcodegen generate command", async () => {
      const mockExecSync = vi.mocked(childProcess.execSync);
      mockExecSync.mockReturnValue(Buffer.from(""));

      await runXcodeGen("/test/project");

      expect(mockExecSync).toHaveBeenCalledWith("xcodegen generate", {
        cwd: "/test/project",
        stdio: "inherit",
      });
    });

    it("logs success message on completion", async () => {
      const mockExecSync = vi.mocked(childProcess.execSync);
      mockExecSync.mockReturnValue(Buffer.from(""));
      const consoleSpy = vi.spyOn(console, "log");

      await runXcodeGen("/test/project");

      expect(consoleSpy).toHaveBeenCalledWith("Running xcodegen...");
      expect(consoleSpy).toHaveBeenCalledWith(
        "Xcode project generated successfully",
      );
    });

    it("throws error when xcodegen fails", async () => {
      const mockExecSync = vi.mocked(childProcess.execSync);
      mockExecSync.mockImplementation(() => {
        throw new Error("Command failed");
      });

      await expect(runXcodeGen("/test/project")).rejects.toThrow(
        "Failed to run xcodegen. Make sure xcodegen is installed: brew install xcodegen",
      );
    });
  });
});
