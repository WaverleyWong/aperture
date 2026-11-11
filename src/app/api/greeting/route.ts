import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import { getTodayLondonISO, getWeekStartISO } from "@/lib/week";

export const dynamic = "force-dynamic";

// Thinking is on by default on Claude Opus 5, and max_tokens caps thinking plus
// response text together — so this needs far more headroom than the ~120 the
// line itself uses, or the greeting gets truncated mid-sentence.
const MAX_TOKENS = 2000;

export async function GET(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const today = getTodayLondonISO();
    const { searchParams } = new URL(request.url);
    const skipCache = searchParams.get("refresh") === "1";
    // Read-through only: serve today's greeting if one exists, but never
    // generate. Used on page load, where the day's task and calendar data may
    // not have been synced by DayGate yet.
    const cacheOnly = searchParams.get("cacheOnly") === "1";

    // One generation per day unless a refresh is asked for.
    if (!skipCache) {
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
        } catch {
          /* stale or corrupt, regenerate */
        }
      }
    }

    if (cacheOnly) return NextResponse.json({ greeting: "" });

    // The three API calls below come back into our own routes over HTTP, so
    // they have to carry the caller's session cookie — the passcode gate 401s
    // anything without it.
    const cookie = request.headers.get("cookie");
    const internal: RequestInit = {
      cache: "no-store",
      headers: cookie ? { cookie } : {},
    };
    const base = process.env.NEXT_PUBLIC_BASE_URL;

    const [calendarRes, tasksRes, digestRes, recentLogs, weekEntries] =
      await Promise.allSettled([
        fetch(`${base}/api/calendar`, internal),
        fetch(`${base}/api/notion-tasks`, internal),
        fetch(`${base}/api/personal-digest`, internal),
        db.execute({
          sql: "SELECT date, note, mood FROM daily_log ORDER BY date DESC LIMIT 4",
          args: [],
        }),
        db.execute({
          sql: "SELECT entry_date, title FROM week_log WHERE entry_date >= ? ORDER BY entry_date ASC",
          args: [getWeekStartISO(today)],
        }),
      ]);

    // ── Today's calendar ──
    let calendarSummary = "No calendar data.";
    if (calendarRes.status === "fulfilled" && calendarRes.value.ok) {
      const cal = await calendarRes.value.json();
      const events = cal.events || [];
      calendarSummary =
        events.length === 0
          ? "Nothing scheduled today — the day is completely open."
          : `Today's calendar (${events.length} events):\n` +
            events
              .map(
                (e: { time?: string; label?: string; source?: string }) =>
                  `- ${e.time || "All day"}: ${e.label || "Untitled"} (${e.source || "unknown"})`
              )
              .join("\n");
    }

    // ── Today's tasks ──
    let tasksSummary = "No tasks data.";
    if (tasksRes.status === "fulfilled" && tasksRes.value.ok) {
      const data = await tasksRes.value.json();
      const tasks = data.tasks || [];
      if (tasks.length === 0) {
        tasksSummary = "No tasks on the list for today.";
      } else {
        const done = tasks.filter((t: { done: boolean }) => t.done).length;
        tasksSummary =
          `Today's tasks (${tasks.length} total, ${done} already done):\n` +
          tasks
            .slice(0, 12)
            .map(
              (t: { label: string; done: boolean }) =>
                `- ${t.label}${t.done ? " [done]" : ""}`
            )
            .join("\n");
      }
    }

    // ── Personal inbox ──
    let digestSummary = "No email data.";
    if (digestRes.status === "fulfilled" && digestRes.value.ok) {
      const data = await digestRes.value.json();
      const needsReply = data.needsReply || [];
      const fyi = data.fyi || [];
      if (needsReply.length === 0 && fyi.length === 0) {
        digestSummary = "Inbox is quiet — nothing notable.";
      } else {
        const parts: string[] = [];
        if (needsReply.length > 0) {
          parts.push(
            `${needsReply.length} needing a reply: ` +
              needsReply
                .map(
                  (e: { sender: string; subject: string }) =>
                    `${e.sender} (${e.subject})`
                )
                .join(", ")
          );
        }
        if (fyi.length > 0) parts.push(`${fyi.length} FYI`);
        digestSummary = parts.join(". ");
      }
    }

    // ── Recent reflections, for continuity across days ──
    let reflectionSummary = "No recent reflections.";
    if (recentLogs.status === "fulfilled") {
      const entries = recentLogs.value.rows
        .filter((r) => r.note || r.mood)
        .map((r) => {
          const bits: string[] = [`${r.date}`];
          if (r.mood) bits.push(`mood: ${r.mood}`);
          if (r.note) bits.push(`note: "${r.note}"`);
          return `- ${bits.join(" — ")}`;
        });
      if (entries.length > 0) {
        reflectionSummary = `Recent daily reflections:\n${entries.join("\n")}`;
      }
    }

    // ── What actually got finished this week ──
    let weekSummary = "Nothing logged to the week log yet this week.";
    if (weekEntries.status === "fulfilled") {
      const rows = weekEntries.value.rows;
      if (rows.length > 0) {
        weekSummary =
          `Completed and logged so far this week (${rows.length} items):\n` +
          rows.map((r) => `- ${r.entry_date}: ${r.title}`).join("\n");
      }
    }

    const dayName = new Date(`${today}T12:00:00`).toLocaleDateString("en-GB", {
      weekday: "long",
      timeZone: "Europe/London",
    });

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-opus-5",
      max_tokens: MAX_TOKENS,
      // low/medium are strong on Opus 5 and this is the cost lever. Note that
      // effort does not reliably shorten the visible answer — the length rules
      // in the prompt do that.
      output_config: { effort: "medium" },
      messages: [
        {
          role: "user",
          content: `Write the single-line note that sits at the top of Waverley's personal dashboard. It's ${dayName}.

You are her assistant. She reads this once, first thing, above a dashboard that already displays her calendar, task list, inbox and week log.

What this line is for:
Not a summary. She can see the dashboard — repeating its contents back to her is wasted space. Your job is the read she would not get from looking at it: the pattern across days, the tension between two things, the thing that is quietly off, the win she has not registered. Assess and interpret, don't report. If one specific, grounded observation is worth more than a general one, choose the specific one.

Good examples of the kind of move to make:
- connecting something in today's calendar to a pattern in her recent notes
- noticing the week log is thin or heavy in a way that contrasts with how she described the week
- flagging that a task has been sitting undone while related things got finished
- naming a genuine win she logged but moved straight past

Voice:
Warm, but never sycophantic — no praise for its own sake, no cheerleading, no "you've got this". Think a sharp friend who is actually invested and actually paying attention. Witty where the material earns it; if the data isn't funny, don't force it. Dry over jolly. Candid over soft — if something looks like a problem, say so plainly.

Rules:
- Two sentences. Three only if the third genuinely earns its place. This is one line in a header, so keep it tight.
- Address her directly as "you". She uses she/her.
- Only reference things that actually appear in the data below. Never invent or guess a project, task, event or person that isn't listed.
- No greeting ("Good morning", "Happy Tuesday"), no emojis, no sign-off, no motivational filler.
- Never suggest resting, breathing, slowing down or taking it easy. Support momentum.
- If the data is genuinely thin, say something small and true rather than padding it out.

Context:
${calendarSummary}

${tasksSummary}

${digestSummary}

${weekSummary}

${reflectionSummary}

Respond with only the line itself — no preamble, no quotation marks.`,
        },
      ],
    });

    // Opus 5's safety classifiers can decline a request; that arrives as a
    // normal 200 with stop_reason "refusal" and empty content.
    if (response.stop_reason === "refusal") {
      console.error("Greeting declined by safety classifier.");
      return NextResponse.json({
        greeting: "",
        _diag: "declined by safety classifier",
      });
    }

    const textBlock = response.content.find((b) => b.type === "text");
    const greeting =
      textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    if (!greeting) {
      return NextResponse.json({
        greeting: "",
        _diag: `no text block (stop_reason: ${response.stop_reason}, blocks: ${response.content
          .map((b) => b.type)
          .join(",")})`,
      });
    }

    // Overwrites the existing live_state row this route has always used.
    await db.execute({
      sql: `INSERT INTO live_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
            ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
      args: ["greeting", JSON.stringify({ date: today, greeting })],
    });

    return NextResponse.json({ greeting });
  } catch (error) {
    // The UI only ever reads `greeting`, so a failure still renders nothing.
    // `_diag` exists so the cause is visible from the endpoint itself instead
    // of requiring Vercel logs — temporary, remove once this is settled.
    console.error("Greeting API error:", error);
    return NextResponse.json({
      greeting: "",
      _diag: error instanceof Error ? `${error.name}: ${error.message}` : String(error),
    });
  }
}
