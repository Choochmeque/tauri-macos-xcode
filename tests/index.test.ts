import { describe, it, expect } from "vitest";
import * as api from "../src/index.js";

describe("index exports", () => {
  it("exports init function", () => {
    expect(api.init).toBeDefined();
    expect(typeof api.init).toBe("function");
  });

  it("exports dev function", () => {
    expect(api.dev).toBeDefined();
    expect(typeof api.dev).toBe("function");
  });

  it("exports findProjectRoot function", () => {
    expect(api.findProjectRoot).toBeDefined();
    expect(typeof api.findProjectRoot).toBe("function");
  });

  it("exports readTauriConfig function", () => {
    expect(api.readTauriConfig).toBeDefined();
    expect(typeof api.readTauriConfig).toBe("function");
  });

  it("exports getAppInfo function", () => {
    expect(api.getAppInfo).toBeDefined();
    expect(typeof api.getAppInfo).toBe("function");
  });
});
