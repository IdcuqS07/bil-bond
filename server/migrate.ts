import { readdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { closeDatabase, databaseConfigured, pool } from "./db.js";

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const migrationsRoot = path.join(projectRoot, "drizzle");

async function migrate(): Promise<void> {
  try {
    if (!databaseConfigured || !pool) {
      throw new Error("DATABASE_URL is not configured; database migrations require MySQL.");
    }
    await pool.query(`
      CREATE TABLE IF NOT EXISTS schema_migrations (
        version VARCHAR(80) PRIMARY KEY,
        applied_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
      )
    `);

    const files = (await readdir(migrationsRoot))
      .filter((file) => /^\d+_.+\.sql$/.test(file))
      .sort();
    for (const file of files) {
      const version = file.replace(/\.sql$/, "");
      const [rows] = await pool.query(
        "SELECT version FROM schema_migrations WHERE version = ? LIMIT 1",
        [version],
      );
      if (Array.isArray(rows) && rows.length > 0) {
        console.info(`Migration ${version} is already applied.`);
        continue;
      }

      const sql = await readFile(path.join(migrationsRoot, file), "utf8");
      const statements = sql
        .split(";")
        .map((statement) => statement.trim())
        .filter(Boolean);
      for (const statement of statements) await pool.query(statement);
      await pool.query("INSERT INTO schema_migrations (version) VALUES (?)", [version]);
      console.info(`Migration ${version} applied.`);
    }
  } finally {
    await closeDatabase();
  }
}

migrate().catch((error: unknown) => {
  console.error("Database migration failed.", error);
  process.exitCode = 1;
});
