import { defineCommand } from "citty";
import consola from "consola";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

import { buildStartEnv, forwardSignals, toExitCode } from "../start-process.js";

export default defineCommand(
  {
    meta: {
      name: "start",
      description: "Start Tamsi in production mode"
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
      outDir: {
        type: "string",
        description: "Build output directory",
        default: "dist"
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
      const outDir = typeof args.outDir === "string" ? args.outDir : "dist";
      const serverPath = resolve(process.cwd(), outDir, "server.mjs");

      try {
        await access(serverPath);
      } catch {
        consola.error(`Build output not found at ${serverPath}. Run "tamsi build".`);
        throw new Error("Missing build output.");
      }

      const env = buildStartEnv({
        port: typeof args.port === "string" ? args.port : undefined,
        host: typeof args.host === "string" ? args.host : undefined,
        env: typeof args.env === "string" ? args.env : undefined,
        quiet: Boolean(args.quiet),
        health: typeof args.health === "string" ? args.health : undefined,
        noHealth: Boolean(args.noHealth)
      });

      const child = spawn(process.execPath, [serverPath], {
        stdio: "inherit",
        env
      });
      const stopForwarding = forwardSignals(child);

      child.on("exit", (code, signal) => {
        stopForwarding();
        process.exit(toExitCode(code, signal));
      });
    }
  }
)
