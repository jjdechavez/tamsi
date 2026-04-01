import { describe, expect, it } from "vitest";
import { defineEventHandler, defineMiddleware } from "h3";
import { defineMayaRouter } from "../src/router.js";

describe("defineMayaRouter", () => {
  it("returns routes as-is for array input", () => {
    const routes = [
      {
        path: "/hello",
        handler: defineEventHandler(() => "ok")
      }
    ];

    expect(defineMayaRouter(routes)).toBe(routes);
  });

  it("applies basePath and group middleware", () => {
    const group = defineMiddleware(async (_event, next) => next());
    const routeMiddleware = defineMiddleware(async (_event, next) => next());

    const routes = defineMayaRouter({
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
