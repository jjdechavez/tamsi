import { H3, toMiddleware, type EventHandler, type Middleware } from "h3";
import type { MayaConfig } from "./config.js";

function resolveMiddleware(handler: EventHandler | Middleware | string): Middleware {
  if (typeof handler === "string") {
    throw new TypeError(
      `Maya middleware handler must be an EventHandler, received string: ${handler}`
    );
  }

  if (handler.length >= 2) {
    return handler as Middleware;
  }

  const middleware = toMiddleware(handler as EventHandler);
  if (!middleware) {
    throw new TypeError("Failed to convert middleware handler.");
  }

  return middleware;
}

export function createMayaApp(config: MayaConfig): H3 {
  const app = new H3();

  if (config.middleware) {
    for (const item of config.middleware) {
      const middleware = resolveMiddleware(item.handler);
      if (item.path) {
        app.use(item.path, middleware);
      } else {
        app.use(middleware);
      }
    }
  }

  if (config.routes) {
    for (const route of config.routes) {
      app.use(route.path, route.handler);
    }
  }

  return app;
}
