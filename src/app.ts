import { readFile, stat } from "node:fs/promises";
import { isAbsolute, resolve } from "node:path";
import {
	type EventHandler,
	H3,
	type Middleware,
	serveStatic,
	toMiddleware,
	withBase,
} from "h3";
import type { TamsiConfig, TamsiRouteMethod } from "./config.js";

function resolveMiddleware(
	handler: EventHandler | Middleware | string,
): Middleware {
	if (typeof handler === "string") {
		throw new TypeError(
			`Tamsi middleware handler must be an EventHandler, received string: ${handler}`,
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

export function createTamsiApp(
	config: TamsiConfig,
	options: { baseDir?: string } = {},
): H3 {
	const app = new H3();

	const health = config.health ?? { enabled: true };
	if (health.enabled !== false) {
		app.get(health.path ?? "/health", () => ({ ok: true }));
	}

	if (config.serveStatic?.publicDir) {
		const publicPath = config.serveStatic.publicPath ?? "/public";
		const publicDir = isAbsolute(config.serveStatic.publicDir)
			? config.serveStatic.publicDir
			: resolve(options.baseDir ?? process.cwd(), config.serveStatic.publicDir);
		const handler = withBase(publicPath, async (event) => {
			const id = mapStaticId(event.url.pathname);
			const meta = await resolveStaticMeta(publicDir, id);
			if (!meta) {
				return;
			}

			return serveStatic(event, {
				getMeta: async (requestId) =>
					resolveStaticMeta(publicDir, mapStaticId(requestId)),
				getContents: async (requestId) =>
					resolveStaticContents(publicDir, mapStaticId(requestId)),
			});
		});

		app.get(publicPath, handler);

		const matchPath = publicPath.endsWith("/")
			? `${publicPath}**`
			: `${publicPath}/**`;

		app.use(matchPath, handler);
	}

	if (config.middlewares) {
		for (const item of config.middlewares) {
			const middleware = resolveMiddleware(item.handler);
			if (item.path) {
				app.use(item.path, middleware);
			} else {
				app.use(middleware);
			}
		}
	}

	if (config.routes) {
		const basePath = config.routesBasePath ?? "";
		for (const route of config.routes) {
			const fullPath = joinPath(basePath, route.path);
			const method = route.method ?? "ALL";
			const options = route.middleware
				? { middleware: route.middleware }
				: undefined;
			registerRoute(app, method, fullPath, route.handler, options);
		}
	}

	return app;
}

function registerRoute(
	app: H3,
	method: TamsiRouteMethod,
	path: string,
	handler: EventHandler,
	options?: { middleware?: Middleware[] },
) {
	if (method === "ALL") {
		app.all(path, handler, options);
		return;
	}

	app.on(method, path, handler, options);
}

function joinPath(basePath: string, routePath: string) {
	if (!basePath) {
		return routePath;
	}

	const base = basePath.endsWith("/") ? basePath.slice(0, -1) : basePath;
	const tail = routePath.startsWith("/") ? routePath : `/${routePath}`;
	return `${base}${tail}`;
}

function resolveStaticPath(dir: string, id: string) {
	const resolved = resolve(dir, `.${id}`);
	const normalizedDir = dir.endsWith("/") ? dir : `${dir}/`;
	if (!resolved.startsWith(normalizedDir)) {
		return undefined;
	}
	return resolved;
}

function normalizeStaticId(id: string) {
	return id.startsWith("/") ? id : `/${id}`;
}

function mapStaticId(id: string) {
	const normalized = normalizeStaticId(id);
	return normalized === "/" ? "/index.html" : normalized;
}

async function resolveStaticMeta(dir: string, id: string) {
	const resolved = resolveStaticPath(dir, id);
	if (!resolved) {
		return undefined;
	}

	try {
		const stats = await stat(resolved);
		if (!stats.isFile()) {
			return undefined;
		}
		return {
			size: stats.size,
			mtime: stats.mtime,
		};
	} catch {
		return undefined;
	}
}

async function resolveStaticContents(dir: string, id: string) {
	const resolved = resolveStaticPath(dir, id);
	if (!resolved) {
		return undefined;
	}

	try {
		return await readFile(resolved);
	} catch {
		return undefined;
	}
}
