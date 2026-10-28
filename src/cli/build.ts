import {
	access,
	copyFile,
	mkdir,
	readdir,
	rm,
	stat,
	writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve } from "node:path";
import consola from "consola";
import { build } from "esbuild";
import { createJiti } from "jiti";
import type { TamsiConfig } from "../config.js";
import { loadTamsiConfig } from "../loader.js";

interface BuildOptions {
	cwd: string;
	configFile?: string;
	outDir: string;
	clean: boolean;
	minify?: boolean;
	sourcemap?: boolean | "inline" | "external";
	target?: string;
	envFile?: string;
}

interface MiddlewareEntry {
	id: string;
	entryName: string;
	sourcePath: string;
}

export async function buildProject(options: BuildOptions) {
	const { cwd, configFile, outDir, clean } = options;
	const resolver = createJiti(import.meta.url, {
		interopDefault: true,
		moduleCache: false,
	});
	const { config, configFile: resolvedConfigFile } = await loadTamsiConfig({
		cwd,
		configFile,
		import: (id) => resolver.import(id),
		dotenv: options.envFile ? { cwd, fileName: options.envFile } : true,
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

	// String middleware handlers are module paths, not imports, so esbuild
	// cannot discover them from the config. Bundle each one as its own entry.
	const middlewareEntries = collectMiddlewareEntries(config, cwd);

	await build({
		entryPoints: {
			"tamsi.config": resolvedConfigFile,
			...Object.fromEntries(
				middlewareEntries.map((entry) => [entry.entryName, entry.sourcePath]),
			),
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
		chunkNames: "chunks/[name]-[hash]",
	});

	await copyPublicAssets(config, configDir, resolvedOutDir);
	await writeFile(
		resolve(resolvedOutDir, "tamsi.middlewares.mjs"),
		renderMiddlewareManifest(middlewareEntries),
		"utf8",
	);
	await writeFile(
		resolve(resolvedOutDir, "server.mjs"),
		renderServerEntry(),
		"utf8",
	);

	await validateBuildOutputs(resolvedOutDir);
	await logBuildSummary(resolvedOutDir, Boolean(config.serveStatic?.publicDir));

	return {
		outDir: resolvedOutDir,
		configFile: resolvedConfigFile,
	};
}

function renderServerEntry() {
	return `import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { loadTamsiEnv, runTamsiServer } from "tamsi";

const baseDir = dirname(fileURLToPath(import.meta.url));
await loadTamsiEnv();

const { default: config } = await import("./tamsi.config.mjs");
const { default: middlewares } = await import("./tamsi.middlewares.mjs");

await runTamsiServer(config, {
  baseDir,
  importMiddleware: (id) => {
    const load = middlewares[id];
    if (!load) {
      throw new Error("Middleware not found in build output: " + id);
    }
    return load();
  },
});
`;
}

function collectMiddlewareEntries(
	config: TamsiConfig,
	cwd: string,
): MiddlewareEntry[] {
	const ids = new Set<string>();
	for (const item of config.middlewares ?? []) {
		if (typeof item.handler === "string") {
			ids.add(item.handler);
		}
	}

	return [...ids].map((id, index) => ({
		id,
		entryName: `middlewares/${index}`,
		sourcePath: resolve(cwd, id),
	}));
}

function renderMiddlewareManifest(entries: MiddlewareEntry[]) {
	const lines = entries.map(
		(entry) =>
			`  ${JSON.stringify(entry.id)}: () => import(${JSON.stringify(`./${entry.entryName}.mjs`)}),`,
	);
	return `export default {\n${lines.join("\n")}\n};\n`;
}

async function copyPublicAssets(
	config: TamsiConfig,
	configDir: string,
	outDir: string,
) {
	if (!config.serveStatic?.publicDir) {
		return;
	}

	const sourceDir = isAbsolute(config.serveStatic?.publicDir)
		? config.serveStatic.publicDir
		: resolve(configDir, config.serveStatic.publicDir);
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
	const middlewaresPath = resolve(outDir, "tamsi.middlewares.mjs");

	try {
		await access(serverPath);
		await access(configPath);
		await access(middlewaresPath);
	} catch {
		consola.error(
			`Build incomplete. Expected ${serverPath}, ${configPath} and ${middlewaresPath}. Run "tamsi build --clean".`,
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
