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

  await db.execute(`
    CREATE TABLE IF NOT EXISTS week_log (
      id              INTEGER PRIMARY KEY AUTOINCREMENT,
      entry_date      TEXT NOT NULL,
      title           TEXT NOT NULL,
      notion_page_id  TEXT,
      timebox_task_id TEXT,
      note            TEXT,
      created_at      TEXT NOT NULL DEFAULT (datetime('now'))
    )
  `);

  await db.execute(
    "CREATE UNIQUE INDEX IF NOT EXISTS week_log_task_date ON week_log (timebox_task_id, entry_date)"
  );

  await db.execute(
    "CREATE INDEX IF NOT EXISTS week_log_entry_date ON week_log (entry_date)"
  );

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
