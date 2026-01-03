import { Command } from "commander";
import { createRequire } from "module";
import { init } from "./commands/init.js";
import { dev } from "./commands/dev.js";

const require = createRequire(import.meta.url);
const { version } = require("../package.json");

const program = new Command();

program
  .name("tauri-macos-xcode")
  .description("Generate Xcode project for macOS Tauri apps")
  .version(version);

program
  .command("init")
  .description("Initialize macOS Xcode project")
  .option("-p, --path <path>", "Path to Tauri project root")
  .action(async (options) => {
    try {
      await init(options);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program
  .command("dev")
  .description("Start dev server and optionally open Xcode")
  .option("-o, --open", "Open Xcode project")
  .option("-p, --path <path>", "Path to Tauri project root")
  .action(async (options) => {
    try {
      await dev(options);
    } catch (error) {
      console.error("Error:", (error as Error).message);
      process.exit(1);
    }
  });

program.parse();
