// Public API
export { init } from "./commands/init.js";
export { dev } from "./commands/dev.js";
export {
  findProjectRoot,
  readTauriConfig,
  getAppInfo,
  detectPackageManager,
} from "./core/project-discovery.js";
export type { PackageManager } from "./core/project-discovery.js";
export type { TauriConfig, AppInfo, InitOptions, DevOptions } from "./types.js";
