import { getDb } from "./database";

export function runMigrations() {
  const db = getDb();

  db.exec(`
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
  const columns = db.prepare("PRAGMA table_info(daily_log)").all() as { name: string }[];
  if (!columns.some((c) => c.name === "note")) {
    db.exec("ALTER TABLE daily_log ADD COLUMN note TEXT DEFAULT ''");
  }
}

// Run directly via: npx tsx src/db/migrate.ts
if (require.main === module) {
  runMigrations();
  console.log("Migration complete — daily_log table ready.");
}
