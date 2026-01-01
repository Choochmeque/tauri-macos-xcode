import { execSync } from "child_process";

export async function runXcodeGen(projectDir: string): Promise<void> {
  try {
    console.log("Running xcodegen...");
    execSync("xcodegen generate", {
      cwd: projectDir,
      stdio: "inherit",
    });
    console.log("Xcode project generated successfully");
  } catch {
    throw new Error(
      "Failed to run xcodegen. Make sure xcodegen is installed: brew install xcodegen",
    );
  }
}
