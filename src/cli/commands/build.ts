import { defineCommand } from "citty";
import consola from "consola";
import { buildProject } from "../build.js";

export default defineCommand({
  meta: {
    name: "build",
    description: "Build Tamsi app for production"
  },
  args: {
    config: {
      type: "string",
      description: "Path to tamsi config file"
    },
    outDir: {
      type: "string",
      description: "Output directory",
      default: "dist"
    },
    clean: {
      type: "boolean",
      description: "Remove output directory before build",
      default: false
    },
    minify: {
      type: "boolean",
      description: "Minify build output",
      default: false
    },
    sourcemap: {
      type: "string",
      description: "Generate sourcemaps (true, inline, external)",
      default: "false"
    },
    target: {
      type: "string",
      description: "Node target for esbuild (e.g. node18, node20)",
      default: "node18"
    },
    env: {
      type: "string",
      description: "Path to env file (replaces default .env)"
    }
  },
  run: async ({ args }) => {
    const sourcemap = parseSourcemap(args.sourcemap);
    const result = await buildProject({
      cwd: process.cwd(),
      configFile: typeof args.config === "string" ? args.config : undefined,
      outDir: typeof args.outDir === "string" ? args.outDir : "dist",
      clean: Boolean(args.clean),
      minify: Boolean(args.minify),
      sourcemap,
      target: typeof args.target === "string" ? args.target : "node18",
      envFile: typeof args.env === "string" ? args.env : undefined
    });

    consola.success(`Built Tamsi app at ${result.outDir}`);
  }
});

function parseSourcemap(value: string | undefined) {
  if (!value || value === "false") {
    return false;
  }
  if (value === "true") {
    return true;
  }
  if (value === "inline" || value === "external") {
    return value;
  }
  throw new Error(`Invalid sourcemap value: ${value}`);
}
