import type { MayaRoute } from "./config.js";
import type { Middleware } from "h3";

export interface MayaRouterInput {
  basePath?: string;
  middleware?: Middleware[];
  routes: MayaRoute[];
}

function normalizePath(basePath: string | undefined, path: string) {
  if (!basePath) {
    return path;
  }

  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

export function defineMayaRouter(routes: MayaRoute[]): MayaRoute[];
export function defineMayaRouter(input: MayaRouterInput): MayaRoute[];
export function defineMayaRouter(
  input: MayaRoute[] | MayaRouterInput
): MayaRoute[] {
  if (Array.isArray(input)) {
    return input;
  }

  const basePath = input.basePath;
  const groupMiddleware = input.middleware ?? [];

  return input.routes.map((route) => ({
    ...route,
    path: normalizePath(basePath, route.path),
    middleware: groupMiddleware.length
      ? [...groupMiddleware, ...(route.middleware ?? [])]
      : route.middleware
  }));
}
