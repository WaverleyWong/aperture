import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

export async function GET() {
  try {
    await runMigrations();
    const db = getDb();
    const today = getTodayISO();

    // Check cache first
    const cached = await db.execute({
      sql: "SELECT value FROM live_state WHERE key = ?",
      args: ["greeting"],
    });
    if (cached.rows.length > 0) {
      try {
        const data = JSON.parse(cached.rows[0].value as string);
        if (data.date === today) {
          return NextResponse.json({ greeting: data.greeting });
        }
      } catch { /* stale or corrupt, regenerate */ }
    }

    // Gather context from other APIs in parallel
    const [calendarRes, tasksRes, digestRes] = await Promise.allSettled([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notion-tasks`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/personal-digest`),
    ]);

    let calendarSummary = "No calendar data available.";
    if (calendarRes.status === "fulfilled" && calendarRes.value.ok) {
      const cal = await calendarRes.value.json();
      const events = [...(cal.personal || []), ...(cal.work || [])];
      if (events.length === 0) {
        calendarSummary = "No events scheduled today.";
      } else {
        calendarSummary = `Today's events (${events.length} total):\n` +
          events.map((e: { time?: string; summary?: string }) =>
            `- ${e.time || "All day"}: ${e.summary || "Untitled"}`
          ).join("\n");
      }
    }

    let tasksSummary = "No tasks data available.";
    if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
      const data = await tasksRes.value.json();
      const tasks = data.tasks || [];
      const done = tasks.filter((t: { done: boolean }) => t.done).length;
      tasksSummary = `${tasks.length} tasks due today, ${done} already done.`;
    }

    let digestSummary = "No digest data available.";
    if (digestRes.status === "fulfilled" && digestRes.value.ok) {
      const data = await digestRes.value.json();
      const needsReply = data.needsReply?.length || 0;
      const fyi = data.fyi?.length || 0;
      digestSummary = `Emails: ${needsReply} need reply, ${fyi} FYI.`;
    }

    const dayName = new Date().toLocaleDateString("en-GB", { weekday: "long" });

    // Generate greeting
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 100,
      messages: [
        {
          role: "user",
          content: `You are writing a single-line morning greeting for Waverley's personal dashboard. It's ${dayName}. Be concise, warm, and practical — one sentence max. Reference specific details from the context below to make it feel personal and useful. Don't be generic. Don't use emojis. Don't say "Good morning".

Context:
${calendarSummary}
${tasksSummary}
${digestSummary}

Respond with ONLY the greeting line, nothing else.`,
        },
      ],
    });

    const greeting = response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "Make today count.";

    // Cache for the day
    await db.execute({
      sql: `INSERT INTO live_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: ["greeting", JSON.stringify({ date: today, greeting })],
    });

    return NextResponse.json({ greeting });
  } catch (error) {
    console.error("Greeting API error:", error);
    return NextResponse.json({ greeting: "" });
  }
}
