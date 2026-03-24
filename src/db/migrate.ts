import { getDb } from "./database";

export async function runMigrations() {
  const db = getDb();

  await db.execute(`
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

  // Add note column if upgrading from older schema
  const columns = await db.execute("PRAGMA table_info(daily_log)");
  const hasNote = columns.rows.some((c) => c.name === "note");
  if (!hasNote) {
    await db.execute("ALTER TABLE daily_log ADD COLUMN note TEXT DEFAULT ''");
  }
}
