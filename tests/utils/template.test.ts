import { describe, it, expect } from "vitest";
import { replaceTemplateVars } from "../../src/utils/template.js";

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
});
