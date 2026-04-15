import { FileMigrationProvider, Migrator } from "kysely";
import type { Kysely } from "kysely";
import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import type { DB } from "./types";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationsDir = path.resolve(__dirname, "migrations");

export function createMigrator(db: Kysely<DB>): Migrator {
	return new Migrator({
		db,
		provider: new FileMigrationProvider({
			fs,
			path,
			migrationFolder: migrationsDir,
		}),
	});
}

export function getMigrationsDir(): string {
	return migrationsDir;
}
