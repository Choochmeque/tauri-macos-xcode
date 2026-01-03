import { describe, it, expect, vi } from "vitest";
import {
  replaceTemplateVars,
  getTemplatesDir,
  readTemplate,
  processTemplate,
} from "../../src/utils/template.js";
import fs from "fs";

describe("template", () => {
  describe("replaceTemplateVars", () => {
    it("replaces single variable", () => {
      const result = replaceTemplateVars("Hello {{NAME}}!", { NAME: "World" });
      expect(result).toBe("Hello World!");
    });

    it("replaces multiple variables", () => {
      const result = replaceTemplateVars("{{PRODUCT}} v{{VERSION}}", {
        PRODUCT: "MyApp",
        VERSION: "1.0.0",
      });
      expect(result).toBe("MyApp v1.0.0");
    });

    it("replaces same variable multiple times", () => {
      const result = replaceTemplateVars("{{NAME}} and {{NAME}}", {
        NAME: "Test",
      });
      expect(result).toBe("Test and Test");
    });

    it("leaves unknown variables unchanged", () => {
      const result = replaceTemplateVars("{{KNOWN}} {{UNKNOWN}}", {
        KNOWN: "value",
      });
      expect(result).toBe("value {{UNKNOWN}}");
    });

    it("handles empty vars object", () => {
      const result = replaceTemplateVars("{{VAR}}", {});
      expect(result).toBe("{{VAR}}");
    });

    it("handles template with no variables", () => {
      const result = replaceTemplateVars("No variables here", { VAR: "value" });
      expect(result).toBe("No variables here");
    });

    it("handles multiline templates", () => {
      const template = `Line 1: {{VAR1}}
Line 2: {{VAR2}}
Line 3: {{VAR1}}`;
      const result = replaceTemplateVars(template, { VAR1: "A", VAR2: "B" });
      expect(result).toBe(`Line 1: A
Line 2: B
Line 3: A`);
    });
  });

  describe("getTemplatesDir", () => {
    it("returns a valid templates directory path", () => {
      const templatesDir = getTemplatesDir();
      expect(templatesDir).toContain("templates");
      expect(fs.existsSync(templatesDir)).toBe(true);
    });

    it("templates directory contains expected files", () => {
      const templatesDir = getTemplatesDir();
      const files = fs.readdirSync(templatesDir);
      expect(files).toContain("project.yml.template");
      expect(files).toContain("Info.plist.template");
    });

    it("throws when package root not found", async () => {
      const originalExistsSync = fs.existsSync;
      vi.spyOn(fs, "existsSync").mockImplementation((p) => {
        if (String(p).endsWith("package.json")) return false;
        return originalExistsSync(p);
      });

      // Re-import to get fresh module with mocked fs
      vi.resetModules();
      const { getTemplatesDir: freshGetTemplatesDir } =
        await import("../../src/utils/template.js");

      expect(() => freshGetTemplatesDir()).toThrow(
        "Could not find package root",
      );

      vi.restoreAllMocks();
    });
  });

  describe("readTemplate", () => {
    it("reads project.yml.template", () => {
      const content = readTemplate("project.yml.template");
      expect(content).toContain("{{PRODUCT_NAME}}");
      expect(content).toContain("{{BUNDLE_IDENTIFIER}}");
    });

    it("reads Info.plist.template", () => {
      const content = readTemplate("Info.plist.template");
      expect(content).toContain("{{VERSION}}");
      expect(content).toContain("CFBundleName");
    });

    it("throws for non-existent template", () => {
      expect(() => readTemplate("non-existent.template")).toThrow();
    });
  });

  describe("processTemplate", () => {
    it("reads and processes template with variables", () => {
      const vars = {
        PRODUCT_NAME: "TestApp",
        BUNDLE_IDENTIFIER: "com.test.app",
        BUNDLE_ID_PREFIX: "com.test",
        VERSION: "1.0.0",
        MACOS_DEPLOYMENT_TARGET: "11.0",
      };
      const content = processTemplate("project.yml.template", vars);
      expect(content).toContain("TestApp");
      expect(content).toContain("com.test.app");
      expect(content).not.toContain("{{PRODUCT_NAME}}");
    });
  });
});
