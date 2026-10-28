#!/usr/bin/env node
import { defineCommand, runMain } from "citty";
import { createJiti } from "jiti";
import { consola } from "consola";
import { serve } from "h3";
import { resolve, dirname } from "node:path";
import {
  bootLog,
  createTamsiApp,
  loadTamsiConfig,
  resolveTamsiMiddlewares,
  type TamsiConfig
} from "./index.js";
import { resolveServerOptions } from "./cli/resolve.js";

function createResolver(cwd: string, moduleCache: boolean) {
  return createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache
  });
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
): Promise<{ listener: ReturnType<typeof serve>; config: TamsiConfig }> {
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

  const resolvedConfig = await resolveTamsiMiddlewares(
    applyHealthOverrides(config, options),
    (id) => resolver.import(resolve(cwd, id), { default: true })
  );

  const app = createTamsiApp(resolvedConfig, { baseDir: configDir });
  const listener = serve(app, {
    port,
    hostname: host,
    // Tamsi prints its own boot log and owns graceful shutdown.
    silent: true,
    gracefulShutdown: false
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
