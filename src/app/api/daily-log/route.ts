import { NextResponse } from "next/server";
import { Client } from "@notionhq/client";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });
const DATA_SOURCE_ID = "31c6a25e-43e7-80fa-b823-000b12e22547";

const CALORIE_CSV_URL = process.env.NEXT_PUBLIC_CALORIE_CSV_URL!;

function getDateISO(d: Date = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

async function fetchTodoItems(date: string) {
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const res = await notion.dataSources.query({
      data_source_id: DATA_SOURCE_ID,
      filter: { property: "Due Date", date: { equals: date } },
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return res.results.map((page: any) => {
      const props = page.properties;
      const label = props?.Name?.title?.map((t: { plain_text: string }) => t.plain_text).join("") || "";
      const done = props?.Done?.checkbox === true;
      return { label, done };
    });
  } catch {
    return [];
  }
}

async function fetchCalories(date: Date) {
  try {
    const res = await fetch(`${CALORIE_CSV_URL}&_t=${Date.now()}`, { redirect: "follow", cache: "no-store" });
    const text = await res.text();
    const rows = text.split("\n").map((r) => r.split(","));
    const key = `${date.getDate()}/${date.getMonth() + 1}/${date.getFullYear()}`;

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row[0]) continue;
      const parts = row[0].trim().replace(/[-/.]/g, "/").split("/");
      if (parts.length !== 3) continue;
      let [d, m, y] = parts.map((p) => parseInt(p, 10));
      if (y < 100) y += 2000;
      if (`${d}/${m}/${y}` === key) {
        return parseInt(row[3]?.trim(), 10) || 0;
      }
    }
    return 0;
  } catch {
    return 0;
  }
}

// GET: check if a log exists for today
export async function GET() {
  try {
    await runMigrations();
    const today = getDateISO();
    const db = getDb();
    const row = await db.execute({ sql: "SELECT date FROM daily_log WHERE date = ?", args: [today] });
    return NextResponse.json({ exists: row.rows.length > 0, date: today });
  } catch (error: unknown) {
    console.error("Daily log GET error:", error);
    return NextResponse.json({ exists: false, error: "Failed to check daily log" }, { status: 500 });
  }
}

// POST: snapshot a day's data
// Body: { date?, timebox_entries, scribblebox }
// If date is omitted, defaults to yesterday
export async function POST(request: Request) {
  try {
    await runMigrations();

    const body = await request.json().catch(() => ({}));

    // Default to yesterday if no date provided
    const targetDate = body.date || (() => {
      const d = new Date();
      d.setDate(d.getDate() - 1);
      return getDateISO(d);
    })();

    const targetDateObj = new Date(targetDate + "T12:00:00");

    // Use client-provided todo_items if present, otherwise fetch from Notion
    const [todoItems, calorieCount] = await Promise.all([
      body.todo_items ? Promise.resolve(body.todo_items) : fetchTodoItems(targetDate),
      fetchCalories(targetDateObj),
    ]);

    const db = getDb();
    await db.execute({
      sql: `
        INSERT INTO daily_log (date, timebox_entries, todo_items, calorie_count, scribblebox, note)
        VALUES (?, ?, ?, ?, ?, ?)
        ON CONFLICT(date) DO UPDATE SET
          timebox_entries = excluded.timebox_entries,
          todo_items = excluded.todo_items,
          calorie_count = excluded.calorie_count,
          scribblebox = excluded.scribblebox,
          note = excluded.note,
          created_at = datetime('now')
      `,
      args: [
        targetDate,
        JSON.stringify(body.timebox_entries ?? []),
        JSON.stringify(todoItems),
        calorieCount,
        body.scribblebox ?? "",
        body.note ?? "",
      ],
    });

    return NextResponse.json({ success: true, date: targetDate });
  } catch (error: unknown) {
    console.error("Daily log POST error:", error);
    return NextResponse.json({ error: "Failed to save daily log" }, { status: 500 });
  }
}
