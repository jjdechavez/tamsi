import { describe, expect, it } from "vitest";
import { defineTamsiConfig } from "../src/config.js";

describe("defineTamsiConfig", () => {
  it("returns the config object", () => {
    const config = { port: 4321 };
    expect(defineTamsiConfig(config)).toBe(config);
  });
});
