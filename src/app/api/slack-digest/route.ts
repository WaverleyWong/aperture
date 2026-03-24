import { WebClient } from "@slack/web-api";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

type SlackItem = {
  sender: string;
  summary: string;
};

type SlackDigestResult = {
  needsResponse: SlackItem[];
  fyi: SlackItem[];
};

export async function GET() {
  try {
    const token = process.env.SLACK_MCP_TOKEN;
    if (!token) {
      return NextResponse.json(
        { error: "SLACK_MCP_TOKEN not configured" },
        { status: 500 }
      );
    }

    const slack = new WebClient(token);
    const userId = process.env.SLACK_USER_ID!;

    // Build date range: yesterday start-of-day
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    const afterDate = yesterday.toISOString().split("T")[0];

    // Fetch DMs and channel @mentions in parallel
    const [dmResults, mentionResults] = await Promise.all([
      slack.search.messages({
        query: `to:me after:${afterDate}`,
        sort: "timestamp",
        sort_dir: "desc",
        count: 30,
      }),
      slack.search.messages({
        query: `<@${userId}> after:${afterDate}`,
        sort: "timestamp",
        sort_dir: "desc",
        count: 20,
      }),
    ]);

    const dmMessages = (dmResults.messages?.matches || [])
      .filter((m) => m.user !== userId)
      .map((m) => ({
        from: m.username || "Unknown",
        channel: m.channel?.name || "DM",
        text: m.text || "",
        type: "dm" as const,
        ts: m.ts || "",
      }));

    const mentionMessages = (mentionResults.messages?.matches || [])
      .filter((m) => m.user !== userId)
      .filter((m) => m.channel?.name !== undefined)
      .map((m) => ({
        from: m.username || "Unknown",
        channel: m.channel?.name || "Unknown channel",
        text: m.text || "",
        type: "mention" as const,
        ts: m.ts || "",
      }));

    // Deduplicate by timestamp
    const seen = new Set<string>();
    const unique = [...dmMessages, ...mentionMessages].filter((m) => {
      if (seen.has(m.ts)) return false;
      seen.add(m.ts);
      return true;
    });

    if (unique.length === 0) {
      return NextResponse.json({
        needsResponse: [],
        fyi: [],
        messageCount: 0,
      });
    }

    // Build prompt for Claude to triage
    const messageList = unique
      .map(
        (m, i) =>
          `[${i + 1}] Type: ${m.type === "dm" ? "Direct Message" : "Channel Mention"}\nFrom: ${m.from}\nChannel: ${m.channel}\nMessage: ${m.text}\n`
      )
      .join("\n");

    const anthropic = new Anthropic();

    const response = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [
        {
          role: "user",
          content: `You are an executive assistant triaging Slack messages. Categorise these messages into two groups:

1. "needsResponse" — DMs or mentions that require a reply or action. Include the sender's first name (or channel name for mentions prefixed with #), and a concise one-line summary of what they need.

2. "fyi" — messages worth knowing about but no action needed. Same format.

Group multiple messages from the same person into one entry with a combined summary. Skip bot messages, automated notifications, and casual chatter that doesn't need attention.

Respond ONLY with valid JSON in this exact format, no other text:
{"needsResponse": [{"sender": "Name", "summary": "What they need"}], "fyi": [{"sender": "Name", "summary": "One line summary"}]}

Here are the messages:

${messageList}`,
        },
      ],
    });

    let text =
      response.content[0].type === "text" ? response.content[0].text : "";
    text = text
      .replace(/^```(?:json)?\s*\n?/, "")
      .replace(/\n?```\s*$/, "")
      .trim();
    const digest: SlackDigestResult = JSON.parse(text);

    return NextResponse.json({
      needsResponse: digest.needsResponse || [],
      fyi: digest.fyi || [],
      messageCount: unique.length,
    });
  } catch (error: unknown) {
    console.error("Slack Digest API error:", error);
    return NextResponse.json({ error: "Failed to load Slack digest" }, { status: 500 });
  }
}
