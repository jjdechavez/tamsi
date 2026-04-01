#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { createJiti } from "jiti";
import { consola } from "consola";
import chokidar from "chokidar";
import { listen, type Listener } from "listhen";
import { toNodeHandler, type EventHandler } from "h3";
import { resolve, dirname, join } from "node:path";
import {
  bootLog,
  createMayaApp,
  createShutdownHooks,
  loadMayaConfig,
  runBeforeClose,
  type MayaConfig
} from "./index.js";
import { resolveServerOptions } from "./cli/resolve.js";

const defaultConfigGlobs = ["maya.config.*", "routes/**"];
const defaultStartExtensions = new Set([".js", ".mjs", ".cjs"]);

function createResolver(cwd: string, moduleCache: boolean) {
  return createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache
  });
}

async function resolveMiddlewareHandlers(
  config: MayaConfig,
  cwd: string,
  resolver: ReturnType<typeof createResolver>,
  allowTs: boolean
): Promise<MayaConfig> {
  if (!config.middleware?.length) {
    return config;
  }

  const middleware = await Promise.all(
    config.middleware.map(async (item) => {
      if (typeof item.handler !== "string") {
        return item;
      }

      const resolvedPath = resolve(cwd, item.handler);
      if (!allowTs) {
        const ext = resolvedPath.slice(resolvedPath.lastIndexOf("."));
        if (ext && !defaultStartExtensions.has(ext)) {
          throw new Error(
            `Maya start only supports built middleware. Found ${item.handler}. Use maya dev or build first.`
          );
        }
      }

      const mod = await resolver.import<EventHandler>(resolvedPath, {
        default: true
      });

      if (typeof mod !== "function") {
        throw new TypeError(`Invalid middleware export from ${item.handler}`);
      }

      return {
        ...item,
        handler: mod
      };
    })
  );

  return {
    ...config,
    middleware
  };
}

async function startServer(
  args: Record<string, string | boolean | undefined>,
  mode: "dev" | "production"
): Promise<{ listener: Listener; config: MayaConfig }> {
  const cwd = process.cwd();
  const moduleCache = mode === "production";
  const resolver = createResolver(cwd, moduleCache);

  const { config, configFile } = await loadMayaConfig({
    cwd,
    configFile: typeof args.config === "string" ? args.config : undefined,
    import: (id) => resolver.import(id)
  });

  const { port, host } = resolveServerOptions(
    {
      port: typeof args.port === "string" ? args.port : undefined,
      host: typeof args.host === "string" ? args.host : undefined,
      config: typeof args.config === "string" ? args.config : undefined
    },
    config
  );

  const resolvedConfig = await resolveMiddlewareHandlers(
    config,
    cwd,
    resolver,
    mode === "dev"
  );

  const app = createMayaApp(resolvedConfig);
  const listener = await listen(toNodeHandler(app), {
    port,
    hostname: host,
    showURL: false,
    name: "Maya",
    isProd: mode === "production",
    autoClose: false
  });

  const url = listener.url;
  bootLog({
    version: process.env.MAYA_VERSION,
    mode: mode === "dev" ? "Development" : "Production",
    url
  });

  if (configFile) {
    consola.info(`Loaded config: ${configFile}`);
  }

  return { listener, config: resolvedConfig };
}

async function runDev(args: Record<string, string | boolean | undefined>) {
  let listener: Listener | undefined;
  let config: MayaConfig | undefined;
  let restarting = false;
  let pendingRestart = false;
  let shuttingDown = false;

  async function stop() {
    if (listener) {
      await listener.close();
      listener = undefined;
    }
  }

  async function start() {
    const result = await startServer(args, "dev");
    listener = result.listener;
    config = result.config;
  }

  async function restart() {
    if (restarting) {
      pendingRestart = true;
      return;
    }

    restarting = true;
    try {
      await stop();
      await start();
      consola.success("Maya restarted.");
    } finally {
      restarting = false;
      if (pendingRestart) {
        pendingRestart = false;
        await restart();
      }
    }
  }

  await start();

  const cwd = process.cwd()
  const configArgs = typeof args.config === "string" ? args.config : undefined;

  const watchGlobs = (() => {
    if (!configArgs) {
      return defaultConfigGlobs
    }

    const configFile = resolve(cwd, configArgs)
    const configDir = dirname(configFile)

    return [
      configFile,
      join(configDir, "routes/**")
    ]
  })()

  const watcher = chokidar.watch(watchGlobs, {
    cwd,
    ignoreInitial: true
  });

  watcher.on("all", async () => {
    await restart();
  });

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const hooks = createShutdownHooks(config ?? {});
    const timeoutMs = config?.shutdownTimeoutMs ?? 10000;
    consola.info("🕊️ Maya is landing... running shutdown hooks.");
    await runBeforeClose(hooks, {
      timeoutMs,
      onTimeout: () => {
        consola.warn(`Shutdown hooks timed out after ${timeoutMs}ms.`);
      }
    });

    await watcher.close();
    await stop();
    consola.info("🕊️ Maya shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

async function runStart(args: Record<string, string | boolean | undefined>) {
  const { listener, config } = await startServer(args, "production");
  let shuttingDown = false;

  const shutdown = async () => {
    if (shuttingDown) {
      return;
    }

    shuttingDown = true;
    const hooks = createShutdownHooks(config ?? {});
    const timeoutMs = config.shutdownTimeoutMs ?? 10000;
    consola.info("🕊️ Maya is landing... running shutdown hooks.");
    await runBeforeClose(hooks, {
      timeoutMs,
      onTimeout: () => {
        consola.warn(`Shutdown hooks timed out after ${timeoutMs}ms.`);
      }
    });

    await listener.close();
    consola.info("🕊️ Maya shutdown complete.");
    process.exit(0);
  };

  process.on("SIGINT", shutdown);
  process.on("SIGTERM", shutdown);
}

const command = defineCommand({
  meta: {
    name: "maya",
    description: "Maya CLI"
  },
  subCommands: {
    dev: defineCommand({
      meta: {
        name: "dev",
        description: "Start Maya in development mode"
      },
      args: {
        port: {
          type: "string",
          description: "Port to listen on"
        },
        host: {
          type: "string",
          description: "Host to bind"
        },
        config: {
          type: "string",
          description: "Path to maya config file"
        }
      },
      run: async ({ args }) => {
        await runDev(args);
      }
    }),
    start: defineCommand({
      meta: {
        name: "start",
        description: "Start Maya in production mode"
      },
      args: {
        port: {
          type: "string",
          description: "Port to listen on"
        },
        host: {
          type: "string",
          description: "Host to bind"
        },
        config: {
          type: "string",
          description: "Path to maya config file"
        }
      },
      run: async ({ args }) => {
        await runStart(args);
      }
    })
  }
});

runMain(command).catch((error) => {
  consola.error(error);
  process.exit(1);
});
