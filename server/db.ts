import { createPool } from "mysql2/promise";
import { drizzle } from "drizzle-orm/mysql2";
import * as schema from "../drizzle/schema.js";

const databaseUrl = process.env.DATABASE_URL;

export const pool = databaseUrl ? createPool(databaseUrl) : null;
const configuredDatabase = pool ? drizzle(pool, { schema, mode: "default" }) : null;
export const databaseConfigured = Boolean(pool);
export const db = configuredDatabase as NonNullable<typeof configuredDatabase>;

export async function closeDatabase(): Promise<void> {
  if (pool) await pool.end();
}
