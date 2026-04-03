import type { TamsiRoute } from "./config.js";
import type { Middleware } from "h3";

export interface TamsiRouterInput {
  basePath?: string;
  middleware?: Middleware[];
  routes: TamsiRoute[];
}

function normalizePath(basePath: string | undefined, path: string) {
  if (!basePath) {
    return path;
  }

  const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
  const tail = path.startsWith("/") ? path : `/${path}`;
  return `${base}${tail}`;
}

export function defineTamsiRouter(routes: TamsiRoute[]): TamsiRoute[];
export function defineTamsiRouter(input: TamsiRouterInput): TamsiRoute[];
export function defineTamsiRouter(
  input: TamsiRoute[] | TamsiRouterInput
): TamsiRoute[] {
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
