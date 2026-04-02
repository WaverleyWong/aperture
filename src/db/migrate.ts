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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS live_state (
      key        TEXT PRIMARY KEY,
      value      TEXT,
      updated_at TEXT DEFAULT (datetime('now'))
    )
  `);

  await db.execute(`
    CREATE TABLE IF NOT EXISTS chat_messages (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      date       TEXT NOT NULL,
      role       TEXT NOT NULL,
      content    TEXT NOT NULL,
      created_at TEXT DEFAULT (datetime('now'))
    )
  `);

  // Add columns if upgrading from older schema
  const columns = await db.execute("PRAGMA table_info(daily_log)");
  const colNames = new Set(columns.rows.map((c) => c.name as string));
  if (!colNames.has("note")) {
    await db.execute("ALTER TABLE daily_log ADD COLUMN note TEXT DEFAULT ''");
  }
  if (!colNames.has("mood")) {
    await db.execute("ALTER TABLE daily_log ADD COLUMN mood TEXT DEFAULT ''");
  }
}
