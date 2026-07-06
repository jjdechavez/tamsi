import { describe, expect, it } from "vitest";
import {
  getHeader,
  getHeaders,
  getRequestURL,
  getRouterParam,
  getRouterParams,
  getValidatedRouterParams,
  setResponseStatus
} from "../src/h3.js";

describe("tamsi h3 exports", () => {
  it("re-exports commonly needed h3 utilities", () => {
    expect(getRouterParam).toBeTypeOf("function");
    expect(getRouterParams).toBeTypeOf("function");
    expect(getHeaders).toBeTypeOf("function");
    expect(getHeader).toBeTypeOf("function");
    expect(setResponseStatus).toBeTypeOf("function");
    expect(getRequestURL).toBeTypeOf("function");
    expect(getValidatedRouterParams).toBeTypeOf("function");
  });
});
