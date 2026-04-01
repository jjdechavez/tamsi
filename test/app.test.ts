import { describe, expect, it } from "vitest";
import { defineEventHandler, defineMiddleware } from "h3";
import { mkdtemp, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
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

  it("adds health route by default", async () => {
    const app = createMayaApp({});
    const response = await app.fetch(new Request("http://localhost/health"));
    expect(response.status).toBe(200);
  });

  it("can disable health route", async () => {
    const app = createMayaApp({ health: { enabled: false } });
    const response = await app.fetch(new Request("http://localhost/health"));
    expect(response.status).toBe(404);
  });

  it("serves static files when enabled", async () => {
    const tempDir = await mkdtemp(join(tmpdir(), "maya-static-"));
    try {
      await writeFile(join(tempDir, "hello.txt"), "hello");
      const app = createMayaApp({
        publicDir: tempDir,
        publicPath: "/public"
      });
      const response = await app.fetch(
        new Request("http://localhost/public/hello.txt")
      );
      expect(response.status).toBe(200);
      expect(await response.text()).toBe("hello");
    } finally {
      await rm(tempDir, { recursive: true, force: true });
    }
  });

  it("applies routesBasePath", async () => {
    const app = createMayaApp({
      routesBasePath: "/api",
      routes: [
        {
          path: "/ping",
          handler: defineEventHandler(() => ({ ok: true }))
        }
      ]
    });

    const response = await app.fetch(new Request("http://localhost/api/ping"));
    expect(response.status).toBe(200);
  });

  it("throws when middleware handler is a string", () => {
    expect(() =>
      createMayaApp({
        middleware: [{ handler: "./middleware.ts" as unknown as never }]
      })
    ).toThrow("Maya middleware handler must be an EventHandler");
  });
});
