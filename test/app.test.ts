import { describe, expect, it } from "vitest";
import { defineEventHandler, defineMiddleware } from "h3";
import { createMayaApp } from "../src/app.js";

describe("createMayaApp", () => {
  it("registers middleware and routes", async () => {
    let middlewareCalled = false;
    const middleware = defineMiddleware(async (_event, next) => {
      middlewareCalled = true;
      await next();
    });
    const route = defineEventHandler(() => ({ ok: true }));

    const app = createMayaApp({
      middleware: [{ handler: middleware }],
      routes: [{ path: "/hello", handler: route }]
    });

    const response = await app.request("http://localhost/hello");
    const body = await response.json();
    expect(body).toEqual({ ok: true });
    expect(middlewareCalled).toBe(true);
  });

  it("throws when middleware handler is a string", () => {
    expect(() =>
      createMayaApp({
        middleware: [{ handler: "./middleware.ts" as unknown as never }]
      })
    ).toThrow("Maya middleware handler must be an EventHandler");
  });
});
