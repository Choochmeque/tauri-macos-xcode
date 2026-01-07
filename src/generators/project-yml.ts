import fs from "fs";
import path from "path";
import { AppInfo, TemplateVars } from "../types.js";
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

  fs.writeFileSync(path.join(macosDir, "project.yml"), content);
  console.log("  Created project.yml");
}
