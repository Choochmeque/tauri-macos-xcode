import fs from "fs";
import path from "path";
import { AppInfo, FileAssociation } from "../types.js";
import { readTemplate } from "../utils/template.js";

function generateDocumentType(assoc: FileAssociation): string {
  const lines: string[] = ["    <dict>"];

  // CFBundleTypeName - defaults to first extension
  const name = assoc.name || assoc.ext[0];
  lines.push(`      <key>CFBundleTypeName</key>`);
  lines.push(`      <string>${name}</string>`);

  // CFBundleTypeRole - defaults to Editor
  const role = assoc.role || "Editor";
  lines.push(`      <key>CFBundleTypeRole</key>`);
  lines.push(`      <string>${role}</string>`);

  // CFBundleTypeExtensions
  lines.push(`      <key>CFBundleTypeExtensions</key>`);
  lines.push(`      <array>`);
  for (const ext of assoc.ext) {
    lines.push(`        <string>${ext}</string>`);
  }
  lines.push(`      </array>`);

  // LSItemContentTypes (optional)
  if (assoc.contentTypes && assoc.contentTypes.length > 0) {
    lines.push(`      <key>LSItemContentTypes</key>`);
    lines.push(`      <array>`);
    for (const ct of assoc.contentTypes) {
      lines.push(`        <string>${ct}</string>`);
    }
    lines.push(`      </array>`);
  }

  // LSHandlerRank - defaults to Default
  const rank = assoc.rank || "Default";
  lines.push(`      <key>LSHandlerRank</key>`);
  lines.push(`      <string>${rank}</string>`);

  lines.push("    </dict>");
  return lines.join("\n");
}

function generateExportedType(assoc: FileAssociation): string | undefined {
  if (!assoc.exportedType) return undefined;

  const exp = assoc.exportedType;
  const lines: string[] = ["    <dict>"];

  // UTTypeIdentifier
  lines.push(`      <key>UTTypeIdentifier</key>`);
  lines.push(`      <string>${exp.identifier}</string>`);

  // UTTypeConformsTo (optional)
  if (exp.conformsTo && exp.conformsTo.length > 0) {
    lines.push(`      <key>UTTypeConformsTo</key>`);
    lines.push(`      <array>`);
    for (const ct of exp.conformsTo) {
      lines.push(`        <string>${ct}</string>`);
    }
    lines.push(`      </array>`);
  }

  // UTTypeTagSpecification with extensions
  lines.push(`      <key>UTTypeTagSpecification</key>`);
  lines.push(`      <dict>`);
  lines.push(`        <key>public.filename-extension</key>`);
  lines.push(`        <array>`);
  for (const ext of assoc.ext) {
    lines.push(`          <string>${ext}</string>`);
  }
  lines.push(`        </array>`);
  lines.push(`      </dict>`);

  lines.push("    </dict>");
  return lines.join("\n");
}

export function generateInfoPlist(macosDir: string, appInfo: AppInfo): void {
  const targetDir = path.join(macosDir, `${appInfo.productName}_macOS`);

  // Ensure directory exists
  fs.mkdirSync(targetDir, { recursive: true });

  // Load template (uses Xcode build variables, no substitution needed)
  let content = readTemplate("Info.plist.template");

  // Add file associations if specified
  if (appInfo.fileAssociations && appInfo.fileAssociations.length > 0) {
    const insertPoint = "</dict>\n</plist>";

    // Generate CFBundleDocumentTypes
    const documentTypes = appInfo.fileAssociations
      .map(generateDocumentType)
      .join("\n");

    let additions = `  <key>CFBundleDocumentTypes</key>\n  <array>\n${documentTypes}\n  </array>\n`;

    // Generate UTExportedTypeDeclarations (only for associations with exportedType)
    const exportedTypes = appInfo.fileAssociations
      .map(generateExportedType)
      .filter((t): t is string => t !== undefined);

    if (exportedTypes.length > 0) {
      additions += `  <key>UTExportedTypeDeclarations</key>\n  <array>\n${exportedTypes.join("\n")}\n  </array>\n`;
    }

    content = content.replace(insertPoint, additions + insertPoint);
  }

  fs.writeFileSync(path.join(targetDir, "Info.plist"), content);
  console.log(`  Created ${appInfo.productName}_macOS/Info.plist`);
}
