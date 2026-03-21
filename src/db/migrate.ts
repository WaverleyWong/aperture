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
      created_at      TEXT DEFAULT (datetime('now'))
    )
  `);
}

// Run directly via: npx tsx src/db/migrate.ts
if (require.main === module) {
  runMigrations();
  console.log("Migration complete — daily_log table ready.");
}
