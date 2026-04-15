import { mkdir, readdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

export type TemplateName = "minimal" | "standard";

export interface InitOptions {
	name: string;
	template: TemplateName;
	cwd: string;
	force: boolean;
	port: number;
	features?: {
		kysely: boolean;
		betterAuth: boolean;
	};
	db?: "sqlite" | "postgres";
}

const templateRoot = resolve(
	fileURLToPath(new URL("../../templates", import.meta.url)),
);

export async function initProject(options: InitOptions) {
	const targetDir = resolve(options.cwd, options.name);
	const templateDir = resolve(templateRoot, options.template);

	await ensureEmptyDir(targetDir, options.force);
	await copyTemplate(templateDir, targetDir, {
		__NAME__: options.name,
		__PORT__: String(options.port),
	});

	await applyFeatures(targetDir, options);

	return targetDir;
}

type FeatureSpec = {
	dependencies?: Record<string, string>;
	env?: string[];
	patches?: Array<{
		file: string;
		insertAfter?: string;
		insertBefore?: string;
		lines: string[];
	}>;
	scripts?: Record<string, string>;
};

async function applyFeatures(targetDir: string, options: InitOptions) {
	const features = [] as string[];
	if (options.features?.kysely) {
		features.push("kysely");
	}
	if (options.features?.betterAuth) {
		features.push("better-auth");
	}

	for (const featureName of features) {
		await applyFeature(targetDir, featureName, options);
	}
}

async function applyFeature(
	targetDir: string,
	featureName: string,
	options: InitOptions,
) {
	const featureDir = resolve(templateRoot, "features", featureName);
	const specPath = resolve(featureDir, "feature.json");
	const specContents = await readFile(specPath, "utf8");
	const spec = JSON.parse(specContents) as FeatureSpec;

	await copyTemplate(
		featureDir,
		targetDir,
		{
			__NAME__: options.name,
			__PORT__: String(options.port),
			__DB__: options.db ?? "sqlite",
		},
		{ exclude: new Set(["feature.json"]) },
	);

	if (spec.patches?.length) {
		for (const patch of spec.patches) {
			const filePath = resolve(targetDir, patch.file);
			const contents = await readFile(filePath, "utf8");
			const updated = applyInsertPatch(contents, patch);
			await writeFile(filePath, updated, "utf8");
		}
	}

	if (spec.dependencies && Object.keys(spec.dependencies).length > 0) {
		await applyDependencies(targetDir, spec.dependencies);
	}

	if (spec.env?.length) {
		await applyEnv(targetDir, spec.env);
	}

	if (spec.scripts && Object.keys(spec.scripts).length > 0) {
		await applyScripts(targetDir, spec.scripts);
	}
}

async function ensureEmptyDir(targetDir: string, force: boolean) {
	try {
		const entries = await readdir(targetDir);
		if (entries.length > 0 && !force) {
			throw new Error(`Target directory is not empty: ${targetDir}`);
		}
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
		await mkdir(targetDir, { recursive: true });
	}
}

async function copyTemplate(
	templateDir: string,
	targetDir: string,
	replacements: Record<string, string>,
	options: { exclude?: Set<string> } = {},
) {
	const entries = await readdir(templateDir, { withFileTypes: true });

	for (const entry of entries) {
		if (options.exclude?.has(entry.name)) {
			continue;
		}
		const sourcePath = join(templateDir, entry.name);
		const targetPath = join(targetDir, entry.name);

		if (entry.isDirectory()) {
			await mkdir(targetPath, { recursive: true });
			await copyTemplate(sourcePath, targetPath, replacements);
			continue;
		}

		await mkdir(dirname(targetPath), { recursive: true });
		const contents = await readFile(sourcePath, "utf8");
		const rendered = renderTemplate(contents, replacements);
		await writeFile(targetPath, rendered, "utf8");
	}
}

function applyInsertPatch(
	contents: string,
	patch: { insertAfter?: string; insertBefore?: string; lines: string[] },
) {
	const lines = `${patch.lines.join("\n")}\n`;
	if (patch.insertAfter) {
		const index = contents.indexOf(patch.insertAfter);
		if (index === -1) {
			throw new Error(`Insert marker not found: ${patch.insertAfter}`);
		}
		const insertIndex = index + patch.insertAfter.length;
		return (
			contents.slice(0, insertIndex) +
			"\n" +
			lines +
			contents.slice(insertIndex)
		);
	}

	if (patch.insertBefore) {
		const index = contents.indexOf(patch.insertBefore);
		if (index === -1) {
			throw new Error(`Insert marker not found: ${patch.insertBefore}`);
		}
		return contents.slice(0, index) + lines + contents.slice(index);
	}

	return contents;
}

async function applyDependencies(
	targetDir: string,
	dependencies: Record<string, string>,
) {
	const packagePath = resolve(targetDir, "package.json");
	const contents = await readFile(packagePath, "utf8");
	const pkg = JSON.parse(contents) as { dependencies?: Record<string, string> };
	const existing = pkg.dependencies ?? {};
	for (const [name, version] of Object.entries(dependencies)) {
		if (!existing[name]) {
			existing[name] = version;
		}
	}
	pkg.dependencies = existing;
	await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}

async function applyEnv(targetDir: string, lines: string[]) {
	const envPath = resolve(targetDir, ".env");
	let contents = "";
	try {
		contents = await readFile(envPath, "utf8");
	} catch (error) {
		if ((error as NodeJS.ErrnoException).code !== "ENOENT") {
			throw error;
		}
	}

	const existingKeys = new Set(
		contents
			.split("\n")
			.map((line) => line.split("=")[0]?.trim())
			.filter(Boolean),
	);

	let updated = contents.trimEnd();
	for (const line of lines) {
		const key = line.split("=")[0]?.trim();
		if (!key || existingKeys.has(key)) {
			continue;
		}
		updated += (updated ? "\n" : "") + line;
	}

	if (updated !== contents.trimEnd()) {
		await writeFile(envPath, `${updated}\n`, "utf8");
	}
}

function renderTemplate(
	contents: string,
	replacements: Record<string, string>,
) {
	let output = contents;
	for (const [key, value] of Object.entries(replacements)) {
		output = output.replaceAll(key, value);
	}
	return output;
}

async function applyScripts(
	targetDir: string,
	scripts: Record<string, string>,
) {
	const packagePath = resolve(targetDir, "package.json");
	const contents = await readFile(packagePath, "utf8");
	const pkg = JSON.parse(contents) as { scripts?: Record<string, string> };

	const existing = pkg.scripts ?? {};

	for (const [name, command] of Object.entries(scripts)) {
		if (!existing[name]) {
			existing[name] = command;
		}
	}

	pkg.scripts = existing;

	await writeFile(packagePath, `${JSON.stringify(pkg, null, 2)}\n`, "utf8");
}
