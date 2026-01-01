import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export function replaceTemplateVars(
  template: string,
  vars: Record<string, string>,
): string {
  return template.replace(/\{\{(\w+)\}\}/g, (match, key) => {
    return vars[key] !== undefined ? vars[key] : match;
  });
}

export function getTemplatesDir(): string {
  // In development: src/utils -> src -> tauri-macos-xcode -> templates
  // In production: dist/utils -> dist -> tauri-macos-xcode -> templates
  return path.resolve(__dirname, "..", "..", "templates");
}

export function readTemplate(templateName: string): string {
  const templatesDir = getTemplatesDir();
  const templatePath = path.join(templatesDir, templateName);
  return fs.readFileSync(templatePath, "utf8");
}

export function processTemplate(
  templateName: string,
  vars: Record<string, string>,
): string {
  const template = readTemplate(templateName);
  return replaceTemplateVars(template, vars);
}
