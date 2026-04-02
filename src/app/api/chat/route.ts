import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TONE = `You are Waverley's personal assistant on his Aperture dashboard. Your goal is to surface insights he might miss — moments to celebrate, flags to be aware of. You're witty and acerbic, but not cloying. The effective right hand who gets shit done and actively looks for opportunity to get shit done. You help him be the best version of himself, catch blind spots, and want to build success together. Do not default to encouraging rest — support momentum, don't push for pause. NEVER suggest resting, breathing, or slowing down. Keep responses concise — 2-3 sentences max unless asked for detail. No emojis.`;

type DashboardContext = {
  calendar: string;
  tasks: string;
  finance: string;
  blok: string;
  digest: string;
};

async function gatherDashboardContext(): Promise<DashboardContext> {
  const base = process.env.NEXT_PUBLIC_BASE_URL || "http://localhost:3000";

  const [calRes, taskRes, finRes, blokRes, digestRes] = await Promise.allSettled([
    fetch(`${base}/api/calendar`),
    fetch(`${base}/api/notion-tasks`),
    fetch(`${base}/api/finance`),
    fetch(`${base}/api/blok-metrics`),
    fetch(`${base}/api/personal-digest`),
  ]);

  let calendar = "No calendar data.";
  if (calRes.status === "fulfilled" && calRes.value.ok) {
    const data = await calRes.value.json();
    const events = data.events || [];
    if (events.length === 0) {
      calendar = "Clear calendar today.";
    } else {
      calendar = events.map((e: { time: string; label: string; source: string }) =>
        `${e.time}: ${e.label} (${e.source})`
      ).join(", ");
    }
  }

  let tasks = "No tasks data.";
  if (taskRes.status === "fulfilled" && taskRes.value.ok) {
    const data = await taskRes.value.json();
    const items = data.tasks || [];
    if (items.length === 0) {
      tasks = "No tasks today.";
    } else {
      const done = items.filter((t: { done: boolean }) => t.done).length;
      const labels = items.slice(0, 8).map((t: { label: string; done: boolean }) =>
        `${t.label}${t.done ? " [done]" : ""}`
      ).join(", ");
      tasks = `${items.length} tasks (${done} done): ${labels}`;
    }
  }

  let finance = "No finance data.";
  if (finRes.status === "fulfilled" && finRes.value.ok) {
    const data = await finRes.value.json();
    const w = data.weekly;
    const m = data.monthly || [];
    const parts: string[] = [];
    if (w) {
      parts.push(`Groceries: £${w.groceries.monthTotal}/£${w.groceries.monthTarget}`);
      parts.push(`Going Out: £${w.goingOut.monthTotal}/£${w.goingOut.monthTarget}`);
    }
    for (const cat of m) {
      parts.push(`${cat.label}: £${cat.spent}/£${cat.target}`);
    }
    if (parts.length > 0) finance = parts.join(". ");
  }

  let blok = "No BLOK data.";
  if (blokRes.status === "fulfilled" && blokRes.value.ok) {
    const data = await blokRes.value.json();
    if (data.totalSalesTY) {
      blok = `Sales MTD: £${data.totalSalesTY.toLocaleString()} (LY: £${data.totalSalesLY.toLocaleString()}). Trials: ${data.sc90TrialsTY} (LY: ${data.sc90TrialsLY}). Ad spend: £${Math.round(data.totalAdSpend)}. CAC: £${data.blendedCAC.toFixed(2)}. As of ${data.asOfDate}.`;
    }
  }

  let digest = "No digest data.";
  if (digestRes.status === "fulfilled" && digestRes.value.ok) {
    const data = await digestRes.value.json();
    const nr = data.needsReply || [];
    const fyi = data.fyi || [];
    const parts: string[] = [];
    if (nr.length > 0) {
      parts.push(`${nr.length} emails needing reply: ${nr.map((e: { sender: string }) => e.sender).join(", ")}`);
    }
    if (fyi.length > 0) {
      parts.push(`${fyi.length} FYI emails`);
    }
    if (parts.length > 0) digest = parts.join(". ");
  }

  return { calendar, tasks, finance, blok, digest };
}

function buildSystemPrompt(ctx: DashboardContext): string {
  const dayName = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `${TONE}

Today is ${dayName}. Here is the current state of Waverley's dashboard:

CALENDAR: ${ctx.calendar}
TASKS: ${ctx.tasks}
FINANCES: ${ctx.finance}
BLOK METRICS: ${ctx.blok}
EMAIL DIGEST: ${ctx.digest}

Reference this data naturally when relevant. Don't recite it all back unless asked.`;
}

// GET — load today's conversation
export async function GET() {
  try {
    await runMigrations();
    const db = getDb();
    const today = getTodayISO();

    const result = await db.execute({
      sql: "SELECT role, content, created_at FROM chat_messages WHERE date = ? ORDER BY id ASC",
      args: [today],
    });

    const messages = result.rows.map((r) => ({
      role: r.role as string,
      content: r.content as string,
    }));

    return NextResponse.json({ messages });
  } catch (error) {
    console.error("Chat GET error:", error);
    return NextResponse.json({ messages: [] });
  }
}

// POST — send a message (or request opening message)
export async function POST(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const today = getTodayISO();
    const body = await request.json();
    const userMessage: string | null = body.message || null;
    const requestOpening: boolean = body.requestOpening || false;

    // Load existing conversation
    const existing = await db.execute({
      sql: "SELECT role, content FROM chat_messages WHERE date = ? ORDER BY id ASC",
      args: [today],
    });
    const history = existing.rows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content as string,
    }));

    // Gather dashboard context
    const ctx = await gatherDashboardContext();
    const systemPrompt = buildSystemPrompt(ctx);

    if (requestOpening && history.length === 0) {
      // Generate proactive opening message
      const anthropic = new Anthropic();
      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-6",
        max_tokens: 300,
        system: systemPrompt,
        messages: [
          {
            role: "user",
            content: "Generate a proactive opening insight for my day based on the dashboard data. Something specific and useful — a pattern you've noticed, a flag, or an opportunity. Not a greeting. 2-3 sentences max.",
          },
        ],
      });

      const assistantMsg = response.content[0].type === "text" ? response.content[0].text.trim() : "";

      // Save to DB
      await db.execute({
        sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
        args: [today, "assistant", assistantMsg],
      });

      return NextResponse.json({ role: "assistant", content: assistantMsg });
    }

    if (!userMessage) {
      return NextResponse.json({ error: "No message provided" }, { status: 400 });
    }

    // Save user message
    await db.execute({
      sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
      args: [today, "user", userMessage],
    });

    // Build messages for Anthropic
    const messages = [
      ...history,
      { role: "user" as const, content: userMessage },
    ];

    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 500,
      system: systemPrompt,
      messages,
    });

    const assistantMsg = response.content[0].type === "text" ? response.content[0].text.trim() : "";

    // Save assistant response
    await db.execute({
      sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
      args: [today, "assistant", assistantMsg],
    });

    return NextResponse.json({ role: "assistant", content: assistantMsg });
  } catch (error) {
    console.error("Chat POST error:", error);
    return NextResponse.json({ error: "Chat failed" }, { status: 500 });
  }
}
