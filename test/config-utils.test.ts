import { describe, expect, it } from "vitest";
import { applyConfigDefaults, redactConfig } from "../src/cli/config-utils.js";

describe("applyConfigDefaults", () => {
  it("fills defaults", () => {
    const result = applyConfigDefaults({});
    expect(result.port).toBe(3000);
    expect(result.health).toEqual({ enabled: true, path: "/health" });
  });

  it("preserves existing config", () => {
    const result = applyConfigDefaults({ port: 4444, serveStatic: { publicDir: "public" } });
    expect(result.port).toBe(4444);
    expect(result.serveStatic?.publicPath).toBe("/public");
  });
});

describe("redactConfig", () => {
  it("redacts secret keys", () => {
    const result = redactConfig({ apiKey: "123", token: "456" });
    expect(result).toEqual({ apiKey: "***", token: "***" });
  });
});
