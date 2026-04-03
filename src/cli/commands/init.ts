import { defineCommand } from "citty";
import consola from "consola";
import { resolve } from "node:path";
import { initProject, type TemplateName } from "../init.js";

const defaultPort = 5555;

export default defineCommand({
  meta: {
    name: "init",
    description: "Create a new Tamsi project"
  },
  args: {
    name: {
      type: "positional",
      description: "Project name"
    },
    template: {
      type: "string",
      description: "Template name (minimal or standard)",
      default: "minimal"
    },
    force: {
      type: "boolean",
      description: "Overwrite if directory is not empty",
      default: false
    },
    cwd: {
      type: "string",
      description: "Base directory to create the project in"
    }
  },
  run: async ({ args }) => {
    if (!args.name) {
      throw new Error("Project name is required.");
    }

    const template = args.template as TemplateName;
    if (template !== "minimal" && template !== "standard") {
      throw new Error(`Unknown template: ${args.template}`);
    }

    const targetDir = await initProject({
      name: args.name,
      template,
      cwd: args.cwd ? resolve(process.cwd(), args.cwd) : process.cwd(),
      force: Boolean(args.force),
      port: defaultPort
    });

    consola.success(`Created Tamsi project at ${targetDir}`);
    consola.info(`Next: cd ${args.name} && pnpm install`);
    consola.info("Then: pnpm run tamsi dev");
    consola.info("Tip: set node-linker=isolated in .npmrc for workspace:* linking.");
  }
});
