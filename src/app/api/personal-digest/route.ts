import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type EmailSummary = {
  sender: string;
  subject: string;
  summary: string;
};

type DigestResult = {
  needsReply: EmailSummary[];
  fyi: EmailSummary[];
};

type McpEmail = {
  headers?: { from?: string; subject?: string; date?: string };
  snippet?: string;
};

async function fetchPersonalEmails() {
  const transport = new StdioClientTransport({
    command: "node",
    args: [
      "/Users/waverleywong/.config/mcp/mcp-google-workspace/dist/server.js",
      "--gauth-file",
      "/Users/waverleywong/.config/mcp/mcp-google-workspace/.gauth.json",
      "--accounts-file",
      "/Users/waverleywong/.config/mcp/mcp-google-workspace/.accounts.json",
      "--credentials-dir",
      "/Users/waverleywong/.config/mcp/mcp-google-workspace",
    ],
  });

  const client = new Client({ name: "aperture-personal-digest", version: "1.0.0" });

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "gmail_query_emails",
      arguments: {
        user_id: "waverleybrontewong@gmail.com",
        query: "in:inbox newer_than:2d",
        max_results: 20,
      },
    });

    // The MCP tool returns content as an array of content blocks
    const textBlock = Array.isArray(result.content)
      ? result.content.find((c: { type: string }) => c.type === "text")
      : null;

    if (!textBlock || textBlock.type !== "text") {
      return [];
    }

    const emails: McpEmail[] = JSON.parse(textBlock.text);
    return emails;
  } finally {
    await client.close();
  }
}

export async function GET() {
  try {
    const emails = await fetchPersonalEmails();

    if (emails.length === 0) {
      return NextResponse.json({ needsReply: [], fyi: [], emailCount: 0 });
    }

    // Build prompt for Claude
    const emailList = emails
      .map((m, i) => {
        const from = m.headers?.from || "";
        const subject = m.headers?.subject || "(No subject)";
        const date = m.headers?.date || "";
        const snippet = m.snippet || "";
        return `[${i + 1}] From: ${from}\nSubject: ${subject}\nDate: ${date}\nPreview: ${snippet}\n`;
      })
      .join("\n");

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are a personal assistant triaging emails for someone's personal inbox. Categorise these emails into two groups:

1. "needsReply" — emails that appear to require a response or action from the recipient. Include sender name (just the person's name, not email), subject, and a one-line summary of what they need.

2. "fyi" — notable emails worth knowing about but no action needed. Same format.

Skip obvious spam, marketing newsletters, and automated notifications unless they contain something genuinely important (e.g. property viewings, interview invitations, delivery issues).

Respond ONLY with valid JSON in this exact format, no other text:
{"needsReply": [{"sender": "Name", "subject": "Subject", "summary": "What they need"}], "fyi": [{"sender": "Name", "subject": "Subject", "summary": "One line summary"}]}

Here are the emails:

${emailList}`,
        },
      ],
    });

    let text =
      response.content[0].type === "text" ? response.content[0].text : "";
    text = text.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    const digest: DigestResult = JSON.parse(text);

    return NextResponse.json({
      needsReply: digest.needsReply || [],
      fyi: digest.fyi || [],
      emailCount: emails.length,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Personal Digest API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
