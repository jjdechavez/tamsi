import { build } from "esbuild";
import { createJiti } from "jiti";
import {
  mkdir,
  readdir,
  rm,
  stat,
  copyFile,
  writeFile,
  access
} from "node:fs/promises";
import { dirname, join, resolve, isAbsolute } from "node:path";
import consola from "consola";
import type { TamsiConfig } from "../config.js";
import { loadTamsiConfig } from "../loader.js";

export interface BuildOptions {
  cwd: string;
  configFile?: string;
  outDir: string;
  clean: boolean;
  minify?: boolean;
  sourcemap?: boolean | "inline" | "external";
  target?: string;
  envFile?: string;
}

export async function buildProject(options: BuildOptions) {
  const { cwd, configFile, outDir, clean } = options;
  const resolver = createJiti(import.meta.url, {
    interopDefault: true,
    moduleCache: false
  });
  const { config, configFile: resolvedConfigFile } = await loadTamsiConfig({
    cwd,
    configFile,
    import: (id) => resolver.import(id),
    dotenv: options.envFile ? { cwd, fileName: options.envFile } : true
  });

  if (!resolvedConfigFile) {
    throw new Error("tamsi.config.ts not found.");
  }

  const configDir = dirname(resolvedConfigFile);
  const resolvedOutDir = resolve(cwd, outDir);

  if (clean) {
    await rm(resolvedOutDir, { recursive: true, force: true });
  }

  await mkdir(resolvedOutDir, { recursive: true });

  await build({
    entryPoints: {
      "tamsi.config": resolvedConfigFile
    },
    outdir: resolvedOutDir,
    bundle: true,
    splitting: true,
    format: "esm",
    platform: "node",
    target: options.target ?? "node24",
    packages: "external",
    sourcemap: options.sourcemap ?? false,
    minify: options.minify ?? false,
    outExtension: { ".js": ".mjs" },
    chunkNames: "chunks/[name]-[hash]"
  });

  await copyPublicAssets(config, configDir, resolvedOutDir);
  await writeFile(
    resolve(resolvedOutDir, "server.mjs"),
    renderServerEntry(),
    "utf8"
  );

  await validateBuildOutputs(resolvedOutDir);
  await logBuildSummary(resolvedOutDir, Boolean(config.publicDir));

  return {
    outDir: resolvedOutDir,
    configFile: resolvedConfigFile
  };
}

function renderServerEntry() {
  return `import { createTamsiApp, createShutdownHooks, runBeforeClose, bootLog } from "tamsi";
import { listen } from "listhen";
import { toNodeHandler } from "h3/node";
import { setupDotenv } from "c12";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const baseDir = dirname(fileURLToPath(import.meta.url));
const envFile = process.env.tamsi_ENV_FILE;
await setupDotenv({ cwd: process.cwd(), fileName: envFile || ".env" });

const { default: config } = await import("./tamsi.config.mjs");

const envPort = process.env.PORT ? Number(process.env.PORT) : undefined;
const port = Number.isFinite(envPort) ? envPort : (config.port ?? 3000);
const host = process.env.HOST ?? "localhost";

const runtimeConfig = { ...config };
if (process.env.tamsi_NO_HEALTH === "1") {
  runtimeConfig.health = { enabled: false };
} else if (process.env.tamsi_HEALTH_PATH) {
  runtimeConfig.health = { enabled: true, path: process.env.tamsi_HEALTH_PATH };
}

const app = createTamsiApp(runtimeConfig, { baseDir });
const listener = await listen(toNodeHandler(app), {
  port,
  hostname: host,
  showURL: false,
  name: "Tamsi",
  isProd: true,
  autoClose: false
});

if (process.env.tamsi_QUIET === "1") {
  console.log(listener.url);
} else {
  bootLog({
    version: process.env.tamsi_VERSION,
    mode: "Production",
    url: listener.url
  });
}

let shuttingDown = false;
const shutdown = async () => {
  if (shuttingDown) return;
  shuttingDown = true;

  const hooks = createShutdownHooks(runtimeConfig ?? {});
  const timeoutMs = runtimeConfig.shutdownTimeoutMs ?? 10000;
  await runBeforeClose(hooks, {
    timeoutMs,
    onTimeout: () => {
      console.warn(
        \`Shutdown hooks timed out after \${timeoutMs}ms.\`
      );
    }
  });

  await listener.close();
  process.exit(0);
};

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
`;
}

async function copyPublicAssets(
  config: TamsiConfig,
  configDir: string,
  outDir: string
) {
  if (!config.publicDir) {
    return;
  }

  const sourceDir = isAbsolute(config.publicDir)
    ? config.publicDir
    : resolve(configDir, config.publicDir);
  const targetDir = resolve(outDir, "public");

  try {
    const stats = await stat(sourceDir);
    if (!stats.isDirectory()) {
      return;
    }
  } catch {
    return;
  }

  await copyDir(sourceDir, targetDir);
}

async function validateBuildOutputs(outDir: string) {
  const serverPath = resolve(outDir, "server.mjs");
  const configPath = resolve(outDir, "tamsi.config.mjs");

  try {
    await access(serverPath);
    await access(configPath);
  } catch {
    consola.error(
      `Build incomplete. Expected ${serverPath} and ${configPath}. Run "tamsi build --clean".`
    );
    throw new Error("Build incomplete.");
  }
}

async function logBuildSummary(outDir: string, hasPublicDir: boolean) {
  const publicDir = resolve(outDir, "public");
  const total = await walkDir(outDir, [publicDir]);
  const publicStats = hasPublicDir ? await walkDir(publicDir) : null;

  const moduleFiles = total.files;
  const moduleBytes = total.bytes;
  const publicFiles = publicStats?.files ?? 0;
  const publicBytes = publicStats?.bytes ?? 0;
  const totalFiles = moduleFiles + publicFiles;
  const totalBytes = moduleBytes + publicBytes;

  consola.info(`Files: ${totalFiles} (${formatBytes(totalBytes)})`);
  consola.info(`Modules: ${moduleFiles} (${formatBytes(moduleBytes)})`);
  if (hasPublicDir) {
    consola.info(`Public: ${publicFiles} (${formatBytes(publicBytes)})`);
  }
}

async function walkDir(dirPath: string, excludeDirs: string[] = []) {
  try {
    const dirStat = await stat(dirPath);
    if (!dirStat.isDirectory()) {
      return { files: 0, bytes: 0 };
    }
  } catch {
    return { files: 0, bytes: 0 };
  }

  const entries = await readdir(dirPath, { withFileTypes: true });
  let files = 0;
  let bytes = 0;

  for (const entry of entries) {
    const entryPath = join(dirPath, entry.name);
    if (excludeDirs.includes(entryPath)) {
      continue;
    }

    if (entry.isDirectory()) {
      const nested = await walkDir(entryPath, excludeDirs);
      files += nested.files;
      bytes += nested.bytes;
      continue;
    }

    if (entry.isFile()) {
      const fileStat = await stat(entryPath);
      files += 1;
      bytes += fileStat.size;
    }
  }

  return { files, bytes };
}

function formatBytes(bytes: number) {
  if (bytes < 1024) {
    return `${bytes} B`;
  }
  const kb = bytes / 1024;
  if (kb < 1024) {
    return `${kb.toFixed(1)} kB`;
  }
  const mb = kb / 1024;
  return `${mb.toFixed(1)} MB`;
}

async function copyDir(sourceDir: string, targetDir: string) {
  await mkdir(targetDir, { recursive: true });
  const entries = await readdir(sourceDir, { withFileTypes: true });

  for (const entry of entries) {
    const sourcePath = join(sourceDir, entry.name);
    const targetPath = join(targetDir, entry.name);

    if (entry.isDirectory()) {
      await copyDir(sourcePath, targetPath);
      continue;
    }

    if (entry.isFile()) {
      await copyFile(sourcePath, targetPath);
    }
  }
}
