import { describe, expect, it } from "vitest";
import { defineEventHandler, defineMiddleware } from "h3";
import { defineTamsiRouter } from "../src/router.js";

describe("defineTamsiRouter", () => {
  it("returns routes as-is for array input", () => {
    const routes = [
      {
        path: "/hello",
        handler: defineEventHandler(() => "ok")
      }
    ];

    expect(defineTamsiRouter(routes)).toBe(routes);
  });

  it("applies basePath and group middleware", () => {
    const group = defineMiddleware(async (_event, next) => next());
    const routeMiddleware = defineMiddleware(async (_event, next) => next());

    const routes = defineTamsiRouter({
      basePath: "/api",
      middleware: [group],
      routes: [
        {
          path: "/users",
          handler: defineEventHandler(() => "ok"),
          middleware: [routeMiddleware]
        }
      ]
    });

    expect(routes[0].path).toBe("/api/users");
    expect(routes[0].middleware).toEqual([group, routeMiddleware]);
  });
});
