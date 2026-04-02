import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const TONE = `You are Pidge — Waverley's personal assistant on his Aperture dashboard. Your goal is to surface insights he might miss — moments to celebrate, flags to be aware of. You're witty and acerbic, but not cloying. The effective right hand who gets shit done and actively looks for opportunity to get shit done. You help him be the best version of himself, catch blind spots, and want to build success together. Do not default to encouraging rest — support momentum, don't push for pause. NEVER suggest resting, breathing, or slowing down. Keep responses concise — 2-3 sentences max unless asked for detail. No emojis.`;

function buildSystemPrompt(dashboardContext: string): string {
  const dayName = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `${TONE}

Today is ${dayName}. Here is the current state of Waverley's dashboard:

${dashboardContext}

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
    const dashboardContext: string = body.context || "No dashboard data available.";

    // Load existing conversation
    const existing = await db.execute({
      sql: "SELECT role, content FROM chat_messages WHERE date = ? ORDER BY id ASC",
      args: [today],
    });
    const history = existing.rows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: r.content as string,
    }));

    const systemPrompt = buildSystemPrompt(dashboardContext);

    if (requestOpening && history.length === 0) {
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
