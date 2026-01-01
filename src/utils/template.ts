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

function findPackageRoot(startDir: string): string {
  let dir = startDir;
  while (dir !== path.dirname(dir)) {
    if (fs.existsSync(path.join(dir, "package.json"))) {
      return dir;
    }
    dir = path.dirname(dir);
  }
  throw new Error("Could not find package root");
}

export function getTemplatesDir(): string {
  const packageRoot = findPackageRoot(__dirname);
  return path.join(packageRoot, "templates");
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
