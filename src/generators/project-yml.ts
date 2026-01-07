import fs from "fs";
import path from "path";
import { AppInfo, TemplateVars, FileAssociation } from "../types.js";
import { processTemplate } from "../utils/template.js";

// Map Tauri category names to Apple LSApplicationCategoryType UTIs
// https://developer.apple.com/documentation/bundleresources/information-property-list/lsapplicationcategorytype
const CATEGORY_MAP: Record<string, string> = {
  Business: "public.app-category.business",
  "Developer Tool": "public.app-category.developer-tools",
  "Developer Tools": "public.app-category.developer-tools",
  Education: "public.app-category.education",
  Entertainment: "public.app-category.entertainment",
  Finance: "public.app-category.finance",
  Game: "public.app-category.games",
  Games: "public.app-category.games",
  "Action Game": "public.app-category.action-games",
  "Adventure Game": "public.app-category.adventure-games",
  "Arcade Game": "public.app-category.arcade-games",
  "Board Game": "public.app-category.board-games",
  "Card Game": "public.app-category.card-games",
  "Casino Game": "public.app-category.casino-games",
  "Dice Game": "public.app-category.dice-games",
  "Educational Game": "public.app-category.educational-games",
  "Family Game": "public.app-category.family-games",
  "Kids Game": "public.app-category.kids-games",
  "Music Game": "public.app-category.music-games",
  "Puzzle Game": "public.app-category.puzzle-games",
  "Racing Game": "public.app-category.racing-games",
  "Role Playing Game": "public.app-category.role-playing-games",
  "Simulation Game": "public.app-category.simulation-games",
  "Sports Game": "public.app-category.sports-games",
  "Strategy Game": "public.app-category.strategy-games",
  "Trivia Game": "public.app-category.trivia-games",
  "Word Game": "public.app-category.word-games",
  "Graphics Design": "public.app-category.graphics-design",
  "Graphics & Design": "public.app-category.graphics-design",
  "Health & Fitness": "public.app-category.healthcare-fitness",
  "Healthcare & Fitness": "public.app-category.healthcare-fitness",
  Lifestyle: "public.app-category.lifestyle",
  Medical: "public.app-category.medical",
  Music: "public.app-category.music",
  News: "public.app-category.news",
  Photography: "public.app-category.photography",
  Productivity: "public.app-category.productivity",
  Reference: "public.app-category.reference",
  "Social Networking": "public.app-category.social-networking",
  Sports: "public.app-category.sports",
  Travel: "public.app-category.travel",
  Utility: "public.app-category.utilities",
  Utilities: "public.app-category.utilities",
  Video: "public.app-category.video",
  Weather: "public.app-category.weather",
};

function mapCategory(category: string): string {
  // Already a valid Apple UTI
  if (category.startsWith("public.app-category.")) {
    return category;
  }
  // Map from Tauri category name
  return CATEGORY_MAP[category] || category;
}

function generateFileAssociationsYaml(
  fileAssociations: FileAssociation[],
): string {
  const lines: string[] = [];

  // Generate CFBundleDocumentTypes
  lines.push("        CFBundleDocumentTypes:");
  for (const assoc of fileAssociations) {
    const name = assoc.name || assoc.ext[0];
    const role = assoc.role || "Editor";
    const rank = assoc.rank || "Default";

    lines.push("          - CFBundleTypeName: " + name);
    lines.push("            CFBundleTypeRole: " + role);
    lines.push("            CFBundleTypeExtensions:");
    for (const ext of assoc.ext) {
      lines.push("              - " + ext);
    }
    if (assoc.contentTypes && assoc.contentTypes.length > 0) {
      lines.push("            LSItemContentTypes:");
      for (const ct of assoc.contentTypes) {
        lines.push("              - " + ct);
      }
    }
    lines.push("            LSHandlerRank: " + rank);
  }

  // Generate UTExportedTypeDeclarations for associations with exportedType
  const exportedTypes = fileAssociations.filter((a) => a.exportedType);
  if (exportedTypes.length > 0) {
    lines.push("        UTExportedTypeDeclarations:");
    for (const assoc of exportedTypes) {
      const exp = assoc.exportedType!;
      lines.push("          - UTTypeIdentifier: " + exp.identifier);
      if (exp.conformsTo && exp.conformsTo.length > 0) {
        lines.push("            UTTypeConformsTo:");
        for (const ct of exp.conformsTo) {
          lines.push("              - " + ct);
        }
      }
      lines.push("            UTTypeTagSpecification:");
      lines.push("              public.filename-extension:");
      for (const ext of assoc.ext) {
        lines.push("                - " + ext);
      }
    }
  }

  return lines.join("\n");
}

export function generateProjectYml(macosDir: string, appInfo: AppInfo): void {
  const vars: TemplateVars = {
    PRODUCT_NAME: appInfo.productName,
    BUNDLE_IDENTIFIER: appInfo.identifier,
    BUNDLE_ID_PREFIX: appInfo.bundleIdPrefix,
    VERSION: appInfo.version,
    MACOS_DEPLOYMENT_TARGET: appInfo.macosDeploymentTarget,
  };

  let content = processTemplate("project.yml.template", vars);

  // Insert category as build setting if specified
  if (appInfo.category) {
    const appleCategory = mapCategory(appInfo.category);
    content = content.replace(
      "CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION: YES",
      `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION: YES\n        INFOPLIST_KEY_LSApplicationCategoryType: ${appleCategory}`,
    );
  }

  // Insert copyright as build setting if specified
  if (appInfo.copyright) {
    content = content.replace(
      "CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION: YES",
      `CODE_SIGN_ALLOW_ENTITLEMENTS_MODIFICATION: YES\n        INFOPLIST_KEY_NSHumanReadableCopyright: ${appInfo.copyright}`,
    );
  }

  // Insert file associations into info.properties if specified
  if (appInfo.fileAssociations && appInfo.fileAssociations.length > 0) {
    const fileAssocYaml = generateFileAssociationsYaml(
      appInfo.fileAssociations,
    );
    content = content.replace(
      "        NSHighResolutionCapable: true",
      `        NSHighResolutionCapable: true\n${fileAssocYaml}`,
    );
  }

  // Process frameworks - categorize by type
  const systemFrameworks: string[] = [];
  const embeddedFrameworks: string[] = [];
  const dylibs: string[] = [];

  if (appInfo.frameworks && appInfo.frameworks.length > 0) {
    for (const fw of appInfo.frameworks) {
      if (fw.endsWith(".dylib")) {
        // Dynamic library - needs to be copied to Frameworks
        dylibs.push(fw);
      } else if (fw.includes("/") || fw.includes("\\")) {
        // Has path separator - local framework to embed
        embeddedFrameworks.push(fw);
      } else {
        // Just a name - system framework
        systemFrameworks.push(fw);
      }
    }
  }

  // Add system frameworks as SDK dependencies
  if (systemFrameworks.length > 0) {
    const sdkDeps = systemFrameworks
      .map((fw) => `      - sdk: ${fw}.framework`)
      .join("\n");
    content = content.replace(
      "      - sdk: WebKit.framework",
      `      - sdk: WebKit.framework\n${sdkDeps}`,
    );
  }

  // Add embedded frameworks
  if (embeddedFrameworks.length > 0) {
    const frameworkDeps = embeddedFrameworks
      .map((fw) => `      - framework: ${fw}\n        embed: true`)
      .join("\n");
    content = content.replace(
      "      - sdk: WebKit.framework",
      `      - sdk: WebKit.framework\n${frameworkDeps}`,
    );
  }

  // Collect all files to copy (from both appInfo.files and dylibs)
  // XcodeGen copyFiles uses destination keywords, not paths
  // Group files by destination folder
  interface CopyFileEntry {
    destination: string;
    subpath?: string;
    files: string[];
  }
  const copyGroups: Map<string, CopyFileEntry> = new Map();

  // Map known directories to XcodeGen destinations
  const dirMap: Record<string, string> = {
    Resources: "resources",
    SharedSupport: "sharedSupport",
    Frameworks: "frameworks",
    PlugIns: "plugins",
    MacOS: "executables",
  };

  // Helper to parse Tauri destination path and map to XcodeGen destination
  function parseTauriDestination(destPath: string): {
    destination: string;
    subpath?: string;
  } {
    const parts = destPath.split("/");

    if (parts.length === 1) {
      // File directly in Contents/ (e.g., "embedded.provisionprofile")
      return { destination: "wrapper" };
    }

    const firstDir = parts[0];
    const restParts = parts.slice(1, -1); // Everything except first dir and filename

    const xcodeDestination = dirMap[firstDir];
    if (xcodeDestination) {
      return {
        destination: xcodeDestination,
        subpath: restParts.length > 0 ? restParts.join("/") : undefined,
      };
    }

    // Unknown directory - use wrapper with subpath (all dirs except filename)
    return {
      destination: "wrapper",
      subpath: parts.slice(0, -1).join("/"),
    };
  }

  // Add user-specified files
  if (appInfo.files) {
    for (const [dest, src] of Object.entries(appInfo.files)) {
      const parsed = parseTauriDestination(dest);
      const groupKey = `${parsed.destination}:${parsed.subpath || ""}`;

      if (!copyGroups.has(groupKey)) {
        copyGroups.set(groupKey, {
          destination: parsed.destination,
          subpath: parsed.subpath,
          files: [],
        });
      }
      copyGroups.get(groupKey)!.files.push(src);
    }
  }

  // Add dylibs to be copied to Frameworks directory
  for (const dylib of dylibs) {
    const groupKey = "frameworks:";
    if (!copyGroups.has(groupKey)) {
      copyGroups.set(groupKey, {
        destination: "frameworks",
        files: [],
      });
    }
    copyGroups.get(groupKey)!.files.push(dylib);
  }

  // Add resources to be copied to Resources directory
  if (appInfo.resources && appInfo.resources.length > 0) {
    for (const resource of appInfo.resources) {
      const subpath = resource.target || undefined;
      const groupKey = `resources:${subpath || ""}`;

      if (!copyGroups.has(groupKey)) {
        copyGroups.set(groupKey, {
          destination: "resources",
          subpath,
          files: [],
        });
      }
      copyGroups.get(groupKey)!.files.push(resource.source);
    }
  }

  // Add copyFiles section if there are files to copy
  if (copyGroups.size > 0) {
    const copyEntries: string[] = [];
    for (const group of copyGroups.values()) {
      let entry = `      - destination: ${group.destination}`;
      if (group.subpath) {
        entry += `\n        subpath: ${group.subpath}`;
      }
      entry += "\n        files:";
      for (const file of group.files) {
        entry += `\n          - path: ${file}`;
      }
      copyEntries.push(entry);
    }
    content = content.replace(
      "    postCompileScripts:",
      `    copyFiles:\n${copyEntries.join("\n")}\n    postCompileScripts:`,
    );
  }

  fs.writeFileSync(path.join(macosDir, "project.yml"), content);
  console.log("  Created project.yml");
}
