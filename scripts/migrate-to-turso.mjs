#!/usr/bin/env node
/**
 * One-time script to migrate data from local aperture.db to Turso.
 * Usage: node scripts/migrate-to-turso.mjs
 */
import Database from "better-sqlite3";
import { createClient } from "@libsql/client";
import { readFileSync } from "fs";

// Load .env.local
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
}

const local = new Database("aperture.db", { readonly: true });
const turso = createClient({
  url: process.env.TURSO_DATABASE_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

// Create table in Turso
await turso.execute(`
  CREATE TABLE IF NOT EXISTS daily_log (
    date            TEXT PRIMARY KEY,
    timebox_entries TEXT,
    todo_items      TEXT,
    calorie_count   INTEGER,
    scribblebox     TEXT,
    note            TEXT DEFAULT '',
    created_at      TEXT DEFAULT (datetime('now'))
  )
`);

// Read all rows from local DB
const rows = local.prepare("SELECT * FROM daily_log").all();
console.log(`Found ${rows.length} rows to migrate.\n`);

for (const row of rows) {
  await turso.execute({
    sql: `INSERT OR REPLACE INTO daily_log (date, timebox_entries, todo_items, calorie_count, scribblebox, note, created_at)
          VALUES (?, ?, ?, ?, ?, ?, ?)`,
    args: [row.date, row.timebox_entries, row.todo_items, row.calorie_count, row.scribblebox, row.note, row.created_at],
  });
  console.log(`  ✓ ${row.date}`);
}

// Verify
const result = await turso.execute("SELECT COUNT(*) as count FROM daily_log");
console.log(`\nDone! ${result.rows[0].count} rows in Turso.`);

local.close();
turso.close();
