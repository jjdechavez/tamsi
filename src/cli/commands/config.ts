import { defineCommand } from "citty";
import { loadTamsiConfig } from "../../loader.js";
import { applyConfigDefaults, redactConfig } from "../config-utils.js";

export default defineCommand({
  meta: {
    name: "config",
    description: "Print resolved Tamsi config"
  },
  args: {
    config: {
      type: "string",
      description: "Path to tamsi config file"
    },
    env: {
      type: "string",
      description: "Path to env file (replaces default .env)"
    },
    raw: {
      type: "boolean",
      description: "Print full values without redaction",
      default: false
    },
    showSources: {
      type: "boolean",
      description: "Include config sources metadata",
      default: false
    }
  },
  run: async ({ args }) => {
    const cwd = process.cwd();
    const { config, configFile } = await loadTamsiConfig({
      cwd,
      configFile: typeof args.config === "string" ? args.config : undefined,
      dotenv: typeof args.env === "string" ? { cwd, fileName: args.env } : true
    });

    const resolved = applyConfigDefaults(config);
    const output = args.raw ? resolved : redactConfig(resolved);
    const result = args.showSources
      ? {
          config: output,
          sources: {
            cwd,
            configFile,
            envFile: typeof args.env === "string" ? args.env : undefined
          }
        }
      : { config: output };

    process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
  }
});
