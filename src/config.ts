import type { EventHandler, Middleware, HTTPMethod } from "h3";

export type Awaitable<T> = T | Promise<T>;

export interface TamsiMiddleware {
  path?: string;
  handler: EventHandler | Middleware | string;
}

export type TamsiRouteMethod = HTTPMethod | Lowercase<HTTPMethod> | "ALL";

export interface TamsiRoute {
  method?: TamsiRouteMethod;
  path: string;
  handler: EventHandler;
  middleware?: Middleware[];
}

export interface TamsiHealthOptions {
  enabled?: boolean;
  path?: string;
}

export interface TamsiConfig {
  port?: number;
  routesBasePath?: string;
  publicDir?: string | false;
  publicPath?: string;
  health?: TamsiHealthOptions;
  shutdownTimeoutMs?: number;
  onBeforeClose?: () => Awaitable<void>;
  middleware?: TamsiMiddleware[];
  routes?: TamsiRoute[];
}

export function defineTamsiConfig<T extends TamsiConfig>(config: T): T {
  return config;
}
