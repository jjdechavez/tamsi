import { defineCommand } from "citty";
import consola from "consola";
import chokidar from "chokidar";
import type { serve } from "h3";
import { dirname, resolve } from "node:path";

import { startServer } from "../../cli.js";
import { type TamsiConfig, closeTamsiServer, createShutdownHooks } from "../../index.js";

export default defineCommand(
  {
    meta: {
      name: "dev",
      description: "Start Tamsi in development mode"
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
        description: "Path to tamsi config file"
      },
      env: {
        type: "string",
        description: "Path to env file (replaces default .env)"
      },
      quiet: {
        type: "boolean",
        description: "Reduce output to only the URL",
        default: false
      },
      health: {
        type: "string",
        description: "Override health endpoint path"
      },
      noHealth: {
        type: "boolean",
        description: "Disable health endpoint",
        default: false
      }
    },
    run: async ({ args }) => {
      let listener: ReturnType<typeof serve> | undefined;
      let config: TamsiConfig | undefined;
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
        const result = await startServer(args, "dev", {
          envFile: typeof args.env === "string" ? args.env : undefined,
          quiet: Boolean(args.quiet),
          healthPath: typeof args.health === "string" ? args.health : undefined,
          healthDisabled: Boolean(args.noHealth)
        });
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
          if (!args.quiet) {
            consola.success("Tamsi restarted.");
          }
        } finally {
          restarting = false;
          if (pendingRestart) {
            pendingRestart = false;
            await restart();
          }
        }
      }

      await start();

      const cwd = process.cwd();
      const configArgs = typeof args.config === "string" ? args.config : undefined;

      let watchTargets: string[] = [
        resolve(cwd, "tamsi.config.ts"),
        resolve(cwd, "tamsi.config.mts"),
        resolve(cwd, "tamsi.config.cts"),
        resolve(cwd, "src")
      ];

      if (configArgs) {
        const configFile = resolve(cwd, configArgs);
        const configDir = dirname(configFile);
        watchTargets = [configFile, resolve(configDir, "src")];
      }

      const watcher = chokidar.watch(watchTargets, {
        ignoreInitial: true,
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
        if (!args.quiet) {
          consola.info("🪶 Tamsi is landing... draining requests and running shutdown hooks.");
        }

        await watcher.close();
        const ok = await closeTamsiServer(listener, hooks, {
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
        listener = undefined;
        if (!args.quiet) {
          consola.info("🌿 Tamsi shutdown complete.");
        }
        process.exit(ok ? 0 : 1);
      };

      process.on("SIGINT", shutdown);
      process.on("SIGTERM", shutdown);
    }
  }
)
