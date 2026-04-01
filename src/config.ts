import type { EventHandler, Middleware, HTTPMethod } from "h3";

export type Awaitable<T> = T | Promise<T>;

export interface MayaMiddleware {
  path?: string;
  handler: EventHandler | Middleware | string;
}

export type MayaRouteMethod = HTTPMethod | Lowercase<HTTPMethod> | "ALL";

export interface MayaRoute {
  method?: MayaRouteMethod;
  path: string;
  handler: EventHandler;
  middleware?: Middleware[];
}

export interface MayaHealthOptions {
  enabled?: boolean;
  path?: string;
}

export interface MayaConfig {
  port?: number;
  routesBasePath?: string;
  publicDir?: string | false;
  publicPath?: string;
  health?: MayaHealthOptions;
  shutdownTimeoutMs?: number;
  onBeforeClose?: () => Awaitable<void>;
  middleware?: MayaMiddleware[];
  routes?: MayaRoute[];
}

export function defineMayaConfig<T extends MayaConfig>(config: T): T {
  return config;
}
