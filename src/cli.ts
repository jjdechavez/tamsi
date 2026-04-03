#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { createJiti } from "jiti";
import { consola } from "consola";
import { listen, type Listener } from "listhen";
import { toNodeHandler, type EventHandler } from "h3";
import { resolve, dirname } from "node:path";
import {
  bootLog,
  createTamsiApp,
  loadTamsiConfig,
  type TamsiConfig
} from "./index.js";
import { resolveServerOptions } from "./cli/resolve.js";

const defaultStartExtensions = new Set([".js", ".mjs", ".cjs"]);

function createResolver(cwd: string, moduleCache: boolean) {
  return createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache
  });
}

async function resolveMiddlewareHandlers(
  config: TamsiConfig,
  cwd: string,
  resolver: ReturnType<typeof createResolver>,
  allowTs: boolean
): Promise<TamsiConfig> {
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
            `Tamsi start only supports built middleware. Found ${item.handler}. Use tamsi dev or build first.`
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

type TamsiServerStartupArgs = {
  config?: string
  port?: string
  host?: string
}

type TamsiServerOptions = {
  envFile?: string
  quiet?: boolean
  healthPath?: string
  healthDisabled?: boolean
}

export async function startServer(
  args: TamsiServerStartupArgs,
  mode: "dev" | "production",
  options: TamsiServerOptions = {}
): Promise<{ listener: Listener; config: TamsiConfig }> {
  const cwd = process.cwd();
  const moduleCache = mode === "production";
  const resolver = createResolver(cwd, moduleCache);

  const { config, configFile } = await loadTamsiConfig({
    cwd,
    configFile: typeof args.config === "string" ? args.config : undefined,
    import: (id) => resolver.import(id),
    dotenv: options.envFile ? { cwd, fileName: options.envFile } : true
  });
  const configDir = configFile ? dirname(configFile) : cwd;

  const { port, host } = resolveServerOptions(
    {
      port: typeof args.port === "string" ? args.port : undefined,
      host: typeof args.host === "string" ? args.host : undefined,
      config: typeof args.config === "string" ? args.config : undefined
    },
    config
  );

  const resolvedConfig = await resolveMiddlewareHandlers(
    applyHealthOverrides(config, options),
    cwd,
    resolver,
    mode === "dev"
  );

  const app = createTamsiApp(resolvedConfig, { baseDir: configDir });
  const listener = await listen(toNodeHandler(app), {
    port,
    hostname: host,
    showURL: false,
    name: "Tamsi",
    isProd: mode === "production",
    autoClose: false
  });

  const url = listener.url;
  if (options.quiet) {
    console.log(url);
  } else {
    bootLog({
      version: process.env.TAMSI_VERSION,
      mode: mode === "dev" ? "Development" : "Production",
      url
    });

    if (configFile) {
      consola.info(`Loaded config: ${configFile}`);
    }
  }

  return { listener, config: resolvedConfig };
}

function applyHealthOverrides(config: TamsiConfig, options: TamsiServerOptions) {
  if (options.healthDisabled) {
    return { ...config, health: { enabled: false } };
  }

  if (options.healthPath) {
    return { ...config, health: { enabled: true, path: options.healthPath } };
  }

  return config;
}

const command = defineCommand({
  meta: {
    name: "tamsi",
    description: "Tamsi CLI"
  },
  subCommands: {
    init: import("./cli/commands/init.js").then(r => r.default),
    config: import("./cli/commands/config.js").then(r => r.default),
    dev: import("./cli/commands/dev.js").then(r => r.default),
    start: import("./cli/commands/start.js").then(r => r.default),
    build: import("./cli/commands/build.js").then(r => r.default)
  }
});

runMain(command).catch((error) => {
  consola.error(error);
  process.exit(1);
});
