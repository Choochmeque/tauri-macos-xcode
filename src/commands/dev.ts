import { spawn } from "child_process";
import path from "path";
import fs from "fs";
import { findProjectRoot, readTauriConfig } from "../core/project-discovery.js";
import { DevOptions } from "../types.js";

export async function dev(options: DevOptions): Promise<void> {
  const projectRoot = options.path || findProjectRoot();
  const tauriConfig = readTauriConfig(projectRoot);
  const macosDir = path.join(projectRoot, "src-tauri", "gen", "apple-macos");

  // Check if project exists
  if (!fs.existsSync(path.join(macosDir, "project.yml"))) {
    console.error(
      'macOS Xcode project not found. Run "npx @choochmeque/tauri-macos-xcode init" first.',
    );
    process.exit(1);
  }

  // Read dev command from tauri.conf.json
  const devCommand = tauriConfig.build?.beforeDevCommand;

  if (devCommand) {
    console.log("Starting dev server...");
    const child = spawn(devCommand, [], {
      shell: true,
      cwd: projectRoot,
      stdio: "inherit",
    });

    // Handle cleanup
    process.on("SIGINT", () => {
      child.kill();
      process.exit();
    });

    process.on("SIGTERM", () => {
      child.kill();
      process.exit();
    });
  }

  // Open Xcode if requested
  if (options.open) {
    const files = fs.readdirSync(macosDir);
    const xcodeproj = files.find((f) => f.endsWith(".xcodeproj"));

    if (xcodeproj) {
      console.log(`Opening ${xcodeproj}...`);
      spawn("open", [path.join(macosDir, xcodeproj)], { stdio: "inherit" });
    } else {
      console.error(
        "Xcode project not found. Try running xcodegen manually in:",
        macosDir,
      );
    }
  }

  // Keep process running if dev server is started
  if (devCommand) {
    await new Promise(() => {}); // Keep running forever
  }
}
