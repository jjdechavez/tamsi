import { defineCommand } from "citty";
import consola from "consola";
import { access } from "node:fs/promises";
import { spawn } from "node:child_process";
import { resolve } from "node:path";

export default defineCommand(
  {
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
        consola.error(`Build output not found at ${serverPath}. Run "maya build".`);
        throw new Error("Missing build output.");
      }

      const env = { ...process.env };
      if (typeof args.port === "string") {
        env.PORT = args.port;
      }
      if (typeof args.host === "string") {
        env.HOST = args.host;
      }
      if (typeof args.env === "string") {
        env.MAYA_ENV_FILE = args.env;
      }
      if (args.quiet) {
        env.MAYA_QUIET = "1";
      }
      if (typeof args.health === "string") {
        env.MAYA_HEALTH_PATH = args.health;
      }
      if (args.noHealth) {
        env.MAYA_NO_HEALTH = "1";
      }

      const child = spawn(process.execPath, [serverPath], {
        stdio: "inherit",
        env
      });

      child.on("exit", (code) => {
        process.exit(code ?? 0);
      });
    }
  }
)
