import type { EventHandler, HTTPMethod, Middleware } from "h3";

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
	host?: string;
	port?: number;
	routesBasePath?: string;
	health?: TamsiHealthOptions;
	shutdownTimeoutMs?: number;
	onBeforeClose?: () => Awaitable<void>;
	middlewares?: TamsiMiddleware[];
	routes?: TamsiRoute[];
	serveStatic?: {
		publicDir?: string | false;
		publicPath?: string;
	};
}

export function defineTamsiConfig<T extends TamsiConfig>(config: T): T {
	return config;
}
