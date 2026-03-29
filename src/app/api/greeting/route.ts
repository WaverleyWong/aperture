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

    // Gather context from APIs + database in parallel
    const [calendarRes, tasksRes, digestRes, recentLogs] = await Promise.allSettled([
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/notion-tasks`),
      fetch(`${process.env.NEXT_PUBLIC_BASE_URL}/api/personal-digest`),
      db.execute({
        sql: "SELECT date, note, mood FROM daily_log ORDER BY date DESC LIMIT 3",
        args: [],
      }),
    ]);

    // Calendar / Today's Activities
    let calendarSummary = "No calendar data.";
    if (calendarRes.status === "fulfilled" && calendarRes.value.ok) {
      const cal = await calendarRes.value.json();
      const events = [...(cal.personal || []), ...(cal.work || [])];
      if (events.length === 0) {
        calendarSummary = "No events scheduled today — completely clear calendar.";
      } else {
        calendarSummary = `Today's calendar (${events.length} events):\n` +
          events.map((e: { time?: string; summary?: string }) =>
            `- ${e.time || "All day"}: ${e.summary || "Untitled"}`
          ).join("\n");
      }
    }

    // Tasks
    let tasksSummary = "No tasks data.";
    if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
      const data = await tasksRes.value.json();
      const tasks = data.tasks || [];
      const done = tasks.filter((t: { done: boolean }) => t.done).length;
      const undone = tasks.length - done;
      if (tasks.length === 0) {
        tasksSummary = "No tasks due today.";
      } else {
        const labels = tasks.slice(0, 5).map((t: { label: string }) => t.label).join(", ");
        tasksSummary = `${tasks.length} tasks today (${done} done, ${undone} remaining): ${labels}`;
      }
    }

    // Digest
    let digestSummary = "No email digest.";
    if (digestRes.status === "fulfilled" && digestRes.value.ok) {
      const data = await digestRes.value.json();
      const needsReply = data.needsReply || [];
      const fyi = data.fyi || [];
      if (needsReply.length > 0 || fyi.length > 0) {
        const parts: string[] = [];
        if (needsReply.length > 0) {
          parts.push(`${needsReply.length} emails needing reply: ${needsReply.map((e: { sender: string }) => e.sender).join(", ")}`);
        }
        if (fyi.length > 0) {
          parts.push(`${fyi.length} FYI emails`);
        }
        digestSummary = parts.join(". ");
      } else {
        digestSummary = "Inbox is quiet — nothing notable.";
      }
    }

    // Recent DayGate reflections (last 2-3 days)
    let reflectionSummary = "";
    if (recentLogs.status === "fulfilled") {
      const rows = recentLogs.value.rows;
      if (rows.length > 0) {
        const entries = rows
          .filter((r) => r.note || r.mood)
          .map((r) => {
            const parts: string[] = [`${r.date}`];
            if (r.mood) parts.push(`mood: ${r.mood}`);
            if (r.note) parts.push(`note: "${r.note}"`);
            return parts.join(" — ");
          });
        if (entries.length > 0) {
          reflectionSummary = `Recent reflections:\n${entries.join("\n")}`;
        }
      }
    }

    const dayName = new Date().toLocaleDateString("en-GB", { weekday: "long" });

    // Generate greeting
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 120,
      messages: [
        {
          role: "user",
          content: `Write a single-line morning note for Waverley's personal dashboard. It's ${dayName}.

Rules:
- One sentence, max two. Be specific — reference actual events, tasks, or patterns from the data.
- Tone: witty, slightly acerbic, observant. Think sharp friend, not cheerful assistant.
- Surface genuine insight when you spot it — patterns in mood, an unusually packed/empty day, a contrast worth noting.
- Don't force humour if the data doesn't warrant it. Practical > clever.
- No emojis. No "Good morning". No generic motivational fluff.
- If recent reflections show a pattern (e.g. declining mood, repeated "busy" notes), acknowledge it dryly.

Context:
${calendarSummary}
${tasksSummary}
${digestSummary}
${reflectionSummary || "No recent reflections."}

Respond with ONLY the line, nothing else.`,
        },
      ],
    });

    const greeting = response.content[0].type === "text"
      ? response.content[0].text.trim()
      : "";

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
