import { NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";

export const dynamic = "force-dynamic";

function getTodayISO(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

const FOCUS_OPTIONS = ["Health and Wellness", "BLOK", "Social", "Finance + Mortgage", "Admin", "Development"];

const TONE = `You are Pidge — Waverley's personal assistant on his Aperture dashboard. Your goal is to surface insights he might miss — moments to celebrate, flags to be aware of. You're witty and warm — sharp but never cold or hostile. Think trusted friend who's genuinely invested in his day going well. You figure things out with him, not at him. The effective right hand who gets shit done and actively looks for opportunity to get shit done. You help him be the best version of himself, catch blind spots, and want to build success together. Do not default to encouraging rest — support momentum, don't push for pause. NEVER suggest resting, breathing, or slowing down. Keep responses concise — 2-3 sentences max unless asked for detail. No emojis.`;

const TOOLS: Anthropic.Tool[] = [
  {
    name: "create_task",
    description: "Create a new task in the Notion sprint database. Use this when the user asks to add, create, or schedule a task.",
    input_schema: {
      type: "object" as const,
      properties: {
        name: { type: "string", description: "Task title" },
        dueDate: { type: "string", description: "Due date in YYYY-MM-DD format" },
        focus: {
          type: "string",
          description: `Focus category. Must be one of: ${FOCUS_OPTIONS.join(", ")}`,
          enum: FOCUS_OPTIONS,
        },
      },
      required: ["name", "dueDate"],
    },
  },
  {
    name: "update_task",
    description: "Update an existing task in Notion. Use this when the user asks to move, reschedule, edit, or mark a task as done.",
    input_schema: {
      type: "object" as const,
      properties: {
        taskName: { type: "string", description: "Name or partial name of the task to find" },
        dueDate: { type: "string", description: "New due date in YYYY-MM-DD format (if changing date)" },
        done: { type: "boolean", description: "Mark as done (true) or not done (false)" },
        focus: {
          type: "string",
          description: `New focus category. Must be one of: ${FOCUS_OPTIONS.join(", ")}`,
          enum: FOCUS_OPTIONS,
        },
      },
      required: ["taskName"],
    },
  },
  {
    name: "search_tasks",
    description: "Search for tasks in Notion by date range or name. Use this to find a task before updating it.",
    input_schema: {
      type: "object" as const,
      properties: {
        startDate: { type: "string", description: "Start date YYYY-MM-DD" },
        endDate: { type: "string", description: "End date YYYY-MM-DD" },
      },
      required: ["startDate"],
    },
  },
];

function buildSystemPrompt(dashboardContext: string): string {
  const dayName = new Date().toLocaleDateString("en-GB", { weekday: "long", day: "numeric", month: "long" });
  return `${TONE}

Today is ${dayName} (${getTodayISO()}). Here is the current state of Waverley's dashboard:

${dashboardContext}

You can create and edit tasks in Notion using the available tools. IMPORTANT: When using tools to create or update tasks, ALWAYS describe the exact change you're proposing BEFORE calling the tool. The system will show the user a confirmation card — the tool call itself is the proposal. For relative dates like "next Tuesday" or "tomorrow", calculate the exact YYYY-MM-DD date.

Focus categories available: ${FOCUS_OPTIONS.join(", ")}

Reference dashboard data naturally when relevant. Don't recite it all back unless asked.`;
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

// POST — send a message, request opening, or execute a confirmed action
export async function POST(request: Request) {
  try {
    await runMigrations();
    const db = getDb();
    const today = getTodayISO();
    const body = await request.json();
    const userMessage: string | null = body.message || null;
    const requestOpening: boolean = body.requestOpening || false;
    const dashboardContext: string = body.context || "No dashboard data available.";
    const executeAction: { tool: string; args: Record<string, unknown> } | null = body.executeAction || null;

    // ── Execute a confirmed action ──
    if (executeAction) {
      const result = await executeNotionAction(executeAction.tool, executeAction.args);

      // Save confirmation message
      const confirmMsg = result.success
        ? `Done — ${result.description}`
        : `Failed: ${result.error}`;

      await db.execute({
        sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
        args: [today, "assistant", confirmMsg],
      });

      return NextResponse.json({ role: "assistant", content: confirmMsg });
    }

    // Load existing conversation and sanitize for Anthropic API
    const existing = await db.execute({
      sql: "SELECT role, content FROM chat_messages WHERE date = ? ORDER BY id ASC",
      args: [today],
    });
    const rawHistory = existing.rows.map((r) => ({
      role: r.role as "user" | "assistant",
      content: (r.content as string).replace(/\n?\n?\[PENDING ACTION\]/g, "").trim(),
    })).filter((m) => m.content.length > 0);

    // Merge consecutive same-role messages (Anthropic requires alternating roles)
    const merged: { role: "user" | "assistant"; content: string }[] = [];
    for (const msg of rawHistory) {
      if (merged.length > 0 && merged[merged.length - 1].role === msg.role) {
        merged[merged.length - 1].content += "\n" + msg.content;
      } else {
        merged.push({ ...msg });
      }
    }
    // Ensure history starts with a user message (Anthropic requirement)
    const firstUserIdx = merged.findIndex((m) => m.role === "user");
    const trimmed = firstUserIdx >= 0 ? merged.slice(firstUserIdx) : [];
    // Keep last 20 messages to avoid token overflow
    const history = trimmed.slice(-20);

    const systemPrompt = buildSystemPrompt(dashboardContext);

    // ── Opening message ──
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
      tools: TOOLS,
      messages,
    });

    // Check if the model wants to use a tool
    const toolUse = response.content.find((c) => c.type === "tool_use");
    const textBlock = response.content.find((c) => c.type === "text");
    const textMsg = textBlock && textBlock.type === "text" ? textBlock.text.trim() : "";

    if (toolUse && toolUse.type === "tool_use") {
      // Return a pending action for user confirmation
      const action = {
        tool: toolUse.name,
        args: toolUse.input as Record<string, unknown>,
      };

      // Build human-readable description of the proposed change
      const description = describeAction(action.tool, action.args);

      // Save the assistant's text message (if any) + pending marker
      const fullMsg = textMsg
        ? `${textMsg}\n\n[PENDING ACTION]`
        : "[PENDING ACTION]";

      await db.execute({
        sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
        args: [today, "assistant", fullMsg],
      });

      return NextResponse.json({
        role: "assistant",
        content: textMsg,
        pendingAction: {
          ...action,
          description,
        },
      });
    }

    // Regular text response
    const assistantMsg = textMsg || "";

    await db.execute({
      sql: "INSERT INTO chat_messages (date, role, content) VALUES (?, ?, ?)",
      args: [today, "assistant", assistantMsg],
    });

    return NextResponse.json({ role: "assistant", content: assistantMsg });
  } catch (error) {
    console.error("Chat POST error:", error);
    const msg = error instanceof Error ? error.message : String(error);
    return NextResponse.json({ error: "Chat failed", detail: msg }, { status: 500 });
  }
}

// ── Action helpers ──

function describeAction(tool: string, args: Record<string, unknown>): string {
  if (tool === "create_task") {
    const parts = [`Create task: "${args.name}"`, `Due: ${args.dueDate}`];
    if (args.focus) parts.push(`Focus: ${args.focus}`);
    return parts.join(" | ");
  }
  if (tool === "update_task") {
    const parts = [`Update task: "${args.taskName}"`];
    if (args.dueDate) parts.push(`Move to: ${args.dueDate}`);
    if (args.done !== undefined) parts.push(args.done ? "Mark done" : "Mark not done");
    if (args.focus) parts.push(`Focus: ${args.focus}`);
    return parts.join(" | ");
  }
  if (tool === "search_tasks") {
    return `Search tasks from ${args.startDate}${args.endDate ? ` to ${args.endDate}` : ""}`;
  }
  return `${tool}: ${JSON.stringify(args)}`;
}

async function executeNotionAction(
  tool: string,
  args: Record<string, unknown>
): Promise<{ success: boolean; description: string; error?: string }> {
  try {
    const { Client } = await import("@notionhq/client");
    const notion = new Client({ auth: process.env.NOTION_API_KEY });
    const DATA_SOURCE_ID = "31c6a25e-43e7-80fa-b823-000b12e22547";
    const DATABASE_ID = "31c6a25e-43e7-80d4-a283-fc9c632d9499"; // Parent DB for page creation

    if (tool === "create_task") {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const properties: Record<string, any> = {
        Name: { title: [{ text: { content: args.name as string } }] },
        "Due Date": { date: { start: args.dueDate as string } },
      };
      if (args.focus) {
        properties.Focus = {
          multi_select: [{ name: args.focus as string }],
        };
      }

      await notion.pages.create({
        parent: { database_id: DATABASE_ID },
        properties,
      });

      return { success: true, description: `Created "${args.name}" for ${args.dueDate}${args.focus ? ` [${args.focus}]` : ""}` };
    }

    if (tool === "update_task") {
      // Search for the task by name across recent dates
      const searchName = (args.taskName as string).toLowerCase();
      const today = new Date();

      // Search 14 days back and 14 days forward
      let matchedPageId: string | null = null;
      let matchedName = "";

      for (let offset = -14; offset <= 14; offset++) {
        const d = new Date(today);
        d.setDate(d.getDate() + offset);
        const dateStr = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

        const result = await notion.dataSources.query({
          data_source_id: DATA_SOURCE_ID,
          filter: { property: "Due Date", date: { equals: dateStr } },
        });

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        for (const page of result.results as any[]) {
          const nameProp = page.properties?.Name;
          const label = nameProp?.title?.map((t: { plain_text: string }) => t.plain_text).join("") || "";
          if (label.toLowerCase().includes(searchName)) {
            matchedPageId = page.id;
            matchedName = label;
            break;
          }
        }
        if (matchedPageId) break;
      }

      if (!matchedPageId) {
        return { success: false, description: "", error: `Could not find a task matching "${args.taskName}"` };
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const properties: Record<string, any> = {};
      if (args.dueDate) {
        properties["Due Date"] = { date: { start: args.dueDate as string } };
      }
      if (args.done !== undefined) {
        properties.Done = { checkbox: args.done as boolean };
      }
      if (args.focus) {
        properties.Focus = { multi_select: [{ name: args.focus as string }] };
      }

      await notion.pages.update({ page_id: matchedPageId, properties });

      const changes: string[] = [];
      if (args.dueDate) changes.push(`moved to ${args.dueDate}`);
      if (args.done !== undefined) changes.push(args.done ? "marked done" : "marked not done");
      if (args.focus) changes.push(`focus set to ${args.focus}`);

      return { success: true, description: `"${matchedName}" — ${changes.join(", ")}` };
    }

    return { success: false, description: "", error: "Unknown action" };
  } catch (error) {
    console.error("Notion action error:", error);
    return { success: false, description: "", error: "Notion API error" };
  }
}
