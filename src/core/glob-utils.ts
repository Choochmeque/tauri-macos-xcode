// Utility functions for glob pattern expansion

import { globSync } from "tinyglobby";

/**
 * Get the static base directory from a glob pattern.
 * Returns the directory part before the first glob character (* ? [ {).
 */
export function getGlobBase(pattern: string): string {
  const globChars = ["*", "?", "[", "{"];
  let firstGlobIndex = pattern.length;

  for (const char of globChars) {
    const idx = pattern.indexOf(char);
    if (idx !== -1 && idx < firstGlobIndex) {
      firstGlobIndex = idx;
    }
  }

  const staticPart = pattern.substring(0, firstGlobIndex);
  const lastSlash = staticPart.lastIndexOf("/");
  return lastSlash > 0 ? staticPart.substring(0, lastSlash) : "";
}

/**
 * Expand a glob pattern to a list of matching files.
 * Normalizes ./ prefix and returns empty array with warning if no matches.
 */
export function expandGlob(pattern: string, cwd: string): string[] {
  // Normalize ./ prefix
  const normalized = pattern.startsWith("./") ? pattern.slice(2) : pattern;

  const files = globSync(normalized, {
    cwd,
    onlyFiles: true,
  });

  if (files.length === 0) {
    console.warn(`Warning: Resource pattern "${pattern}" matched no files`);
  }

  return files;
}
