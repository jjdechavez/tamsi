import { setupDotenv } from "c12";
import { consola } from "consola";
import { type EventHandler, type Middleware, serve } from "h3";

import { createTamsiApp } from "./app.js";
import type { TamsiConfig } from "./config.js";
import { bootLog } from "./log.js";
import { closeTamsiServer, createShutdownHooks } from "./shutdown.js";

export type TamsiModuleImporter = (id: string) => Promise<unknown>;

export interface TamsiRuntimeOptions {
  port: number;
  host: string;
  quiet: boolean;
  version?: string;
  config: TamsiConfig;
}

export interface RunTamsiServerOptions {
  baseDir?: string;
  env?: NodeJS.ProcessEnv;
  importMiddleware?: TamsiModuleImporter;
  signals?: NodeJS.Signals[];
}

export interface TamsiServer {
  listener: ReturnType<typeof serve>;
  close: () => Promise<boolean>;
}

const DEFAULT_PORT = 3000;
const DEFAULT_PRODUCTION_HOST = "0.0.0.0";
const DEFAULT_SHUTDOWN_TIMEOUT_MS = 10000;

/**
 * Resolves production server options from the environment variables that
 * `tamsi start` passes to the built server.
 */
export function resolveRuntimeOptions(
  config: TamsiConfig,
  env: NodeJS.ProcessEnv = process.env
): TamsiRuntimeOptions {
  const envPort = env.PORT ? Number(env.PORT) : undefined;
  const port =
    envPort !== undefined && Number.isFinite(envPort)
      ? envPort
      : (config.port ?? DEFAULT_PORT);
  const host = env.HOST ?? config.host ?? DEFAULT_PRODUCTION_HOST;

  let runtimeConfig = config;
  if (env.TAMSI_NO_HEALTH === "1") {
    runtimeConfig = { ...config, health: { enabled: false } };
  } else if (env.TAMSI_HEALTH_PATH) {
    runtimeConfig = {
      ...config,
      health: { enabled: true, path: env.TAMSI_HEALTH_PATH }
    };
  }

  return {
    port,
    host,
    quiet: env.TAMSI_QUIET === "1",
    version: env.TAMSI_VERSION,
    config: runtimeConfig
  };
}

export async function loadTamsiEnv(env: NodeJS.ProcessEnv = process.env) {
  await setupDotenv({
    cwd: process.cwd(),
    fileName: env.TAMSI_ENV_FILE || ".env"
  });
}

/**
 * Replaces middleware handlers given as module paths with the default export
 * of the module returned by `importModule`.
 */
export async function resolveTamsiMiddlewares(
  config: TamsiConfig,
  importModule: TamsiModuleImporter
): Promise<TamsiConfig> {
  const items = config.middlewares;
  if (!items?.some((item) => typeof item.handler === "string")) {
    return config;
  }

  const middlewares = await Promise.all(
    items.map(async (item) => {
      if (typeof item.handler !== "string") {
        return item;
      }

      const mod = await importModule(item.handler);
      const handler =
        typeof mod === "function"
          ? mod
          : (mod as { default?: unknown } | undefined)?.default;
      if (typeof handler !== "function") {
        throw new TypeError(`Invalid middleware export from ${item.handler}`);
      }

      return {
        ...item,
        handler: handler as EventHandler | Middleware
      };
    })
  );

  return {
    ...config,
    middlewares
  };
}

/**
 * Starts a production server: resolves runtime options, serves the app, and
 * shuts down gracefully on SIGINT/SIGTERM.
 */
export async function runTamsiServer(
  config: TamsiConfig,
  options: RunTamsiServerOptions = {}
): Promise<TamsiServer> {
  const runtime = resolveRuntimeOptions(config, options.env);
  const resolvedConfig = options.importMiddleware
    ? await resolveTamsiMiddlewares(runtime.config, options.importMiddleware)
    : runtime.config;

  const app = createTamsiApp(resolvedConfig, { baseDir: options.baseDir });
  const listener = serve(app, {
    port: runtime.port,
    hostname: runtime.host,
    // Tamsi prints its own boot log and owns graceful shutdown.
    silent: true,
    gracefulShutdown: false
  });
  await listener.ready();

  if (runtime.quiet) {
    console.log(listener.url);
  } else {
    bootLog({
      version: runtime.version,
      mode: "Production",
      url: listener.url
    });
  }

  let closing: Promise<boolean> | undefined;
  const close = () => {
    if (!closing) {
      const timeoutMs =
        resolvedConfig.shutdownTimeoutMs ?? DEFAULT_SHUTDOWN_TIMEOUT_MS;
      closing = closeTamsiServer(listener, createShutdownHooks(resolvedConfig), {
        timeoutMs,
        onTimeout: (phase) => {
          consola.warn(
            phase === "drain"
              ? `Requests did not drain within ${timeoutMs}ms. Closing open connections.`
              : `Shutdown hooks timed out after ${timeoutMs}ms.`
          );
        },
        onError: (error) => {
          consola.error(error);
        }
      });
    }
    return closing;
  };

  for (const signal of options.signals ?? ["SIGINT", "SIGTERM"]) {
    process.on(signal, async () => {
      const ok = await close();
      process.exit(ok ? 0 : 1);
    });
  }

  return { listener, close };
}
