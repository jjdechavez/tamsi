import { Kysely, SqliteDialect } from "kysely";
import Database from "better-sqlite3";

import type { Database as DatabaseSchema } from "../types/db.ts";

const databaseUrl = process.env.DATABASE_URL ?? "file:./dev.db";
const sqlitePath = databaseUrl.startsWith("file:")
  ? databaseUrl.slice("file:".length)
  : databaseUrl;

const dialect = new SqliteDialect({
  database: new Database(sqlitePath)
});

export const db = new Kysely<DatabaseSchema>({ dialect });

export default db;
