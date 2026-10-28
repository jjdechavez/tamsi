import { describe, expect, it } from "vitest";
import { defineEventHandler, defineMiddleware } from "h3";
import { createTamsiApp } from "../src/app.js";
import {
  resolveRuntimeOptions,
  resolveTamsiMiddlewares,
  runTamsiServer
} from "../src/server.js";

describe("resolveRuntimeOptions", () => {
  it("reads TAMSI_* overrides", () => {
    const quiet = resolveRuntimeOptions({}, {
      TAMSI_QUIET: "1",
      TAMSI_VERSION: "1.2.3"
    });
    expect(quiet.quiet).toBe(true);
    expect(quiet.version).toBe("1.2.3");

    const healthPath = resolveRuntimeOptions({}, { TAMSI_HEALTH_PATH: "/hz" });
    expect(healthPath.config.health).toEqual({ enabled: true, path: "/hz" });

    const noHealth = resolveRuntimeOptions({}, { TAMSI_NO_HEALTH: "1" });
    expect(noHealth.config.health).toEqual({ enabled: false });
  });

  it("ignores lowercase tamsi_* variables", () => {
    const resolved = resolveRuntimeOptions({}, { tamsi_QUIET: "1" });
    expect(resolved.quiet).toBe(false);
  });

  it("uses config.host when HOST is not set", () => {
    expect(resolveRuntimeOptions({ host: "127.0.0.1" }, {}).host).toBe(
      "127.0.0.1"
    );
    expect(
      resolveRuntimeOptions({ host: "127.0.0.1" }, { HOST: "::" }).host
    ).toBe("::");
    expect(resolveRuntimeOptions({}, {}).host).toBe("0.0.0.0");
  });

  it("prefers PORT over config.port", () => {
    expect(resolveRuntimeOptions({ port: 4000 }, { PORT: "5000" }).port).toBe(
      5000
    );
    expect(resolveRuntimeOptions({ port: 4000 }, {}).port).toBe(4000);
  });
});

describe("resolveTamsiMiddlewares", () => {
  it("replaces string handlers with the imported default export", async () => {
    const middleware = defineMiddleware(async (event, next) => {
      event.res.headers.set("x-resolved", "yes");
      return next();
    });
    const imported: string[] = [];

    const config = await resolveTamsiMiddlewares(
      {
        middlewares: [{ handler: "./middleware.ts" }],
        routes: [{ path: "/", handler: defineEventHandler(() => "ok") }]
      },
      async (id) => {
        imported.push(id);
        return { default: middleware };
      }
    );

    expect(imported).toEqual(["./middleware.ts"]);
    const response = await createTamsiApp(config).request("http://localhost/");
    expect(response.headers.get("x-resolved")).toBe("yes");
  });

  it("throws when the module has no function export", async () => {
    await expect(
      resolveTamsiMiddlewares(
        { middlewares: [{ handler: "./bad.ts" }] },
        async () => ({ default: "nope" })
      )
    ).rejects.toThrow("Invalid middleware export from ./bad.ts");
  });
});

describe("runTamsiServer", () => {
  it("drains in-flight requests before running onBeforeClose", async () => {
    const events: string[] = [];
    let release: () => void = () => {};
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    let entered: () => void = () => {};
    const handlerEntered = new Promise<void>((resolve) => {
      entered = resolve;
    });

    const { listener, close } = await runTamsiServer(
      {
        routes: [
          {
            path: "/slow",
            handler: defineEventHandler(async () => {
              entered();
              await gate;
              events.push("response");
              return "done";
            })
          }
        ],
        onBeforeClose: () => {
          events.push("hook");
        }
      },
      {
        env: { PORT: "0", HOST: "127.0.0.1", TAMSI_QUIET: "1" },
        signals: []
      }
    );

    const pending = fetch(new URL("/slow", listener.url));
    await handlerEntered;
    const closing = close();
    setTimeout(release, 20);

    const response = await pending;
    expect(await response.text()).toBe("done");
    expect(await closing).toBe(true);
    expect(events).toEqual(["response", "hook"]);
  });
});
