import { Client } from "@notionhq/client";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

function getTodayFormatted(): string {
  return new Date().toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export async function POST(request: Request) {
  try {
    const { text } = await request.json();

    if (!text || !text.trim()) {
      return NextResponse.json({ error: "No text to archive" }, { status: 400 });
    }

    const databaseId = process.env.NOTION_ARCHIVE_DB_ID;
    if (!databaseId) {
      return NextResponse.json({ error: "Archive database not configured" }, { status: 500 });
    }

    // Use Claude to generate a title and tags
    const anthropic = new Anthropic();
    const aiResponse = await anthropic.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 256,
      messages: [
        {
          role: "user",
          content: `Generate a short title (max 8 words) and 2-3 topic tags for this note. Tags should be useful for searching later.

Respond ONLY with valid JSON, no other text:
{"title": "Short title here", "tags": ["tag1", "tag2", "tag3"]}

Note:
${text.slice(0, 2000)}`,
        },
      ],
    });

    let aiText = aiResponse.content[0].type === "text" ? aiResponse.content[0].text : "";
    aiText = aiText.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "").trim();
    const { title, tags } = JSON.parse(aiText) as { title: string; tags: string[] };

    // Build page content blocks
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [
      // Date and tags as a callout block at the top
      {
        object: "block",
        type: "callout",
        callout: {
          rich_text: [
            {
              type: "text",
              text: { content: `${getTodayFormatted()}  ·  ${tags.join(", ")}` },
            },
          ],
          color: "gray_background",
        },
      },
      // Divider
      { object: "block", type: "divider", divider: {} },
    ];

    // Split note text into paragraph blocks (max 2000 chars per block)
    const lines = text.split("\n");
    let current = "";
    for (const line of lines) {
      if (current.length + line.length + 1 > 1900) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: {
            rich_text: [{ type: "text", text: { content: current } }],
          },
        });
        current = line;
      } else {
        current += (current ? "\n" : "") + line;
      }
    }
    if (current) {
      children.push({
        object: "block",
        type: "paragraph",
        paragraph: {
          rich_text: [{ type: "text", text: { content: current } }],
        },
      });
    }

    // Create Notion page
    await notion.pages.create({
      parent: { database_id: databaseId },
      properties: {
        Name: {
          title: [{ text: { content: title } }],
        },
      },
      children,
    });

    return NextResponse.json({ success: true, title, tags });
  } catch (error: unknown) {
    console.error("Archive note error:", error);
    return NextResponse.json({ error: "Failed to archive note" }, { status: 500 });
  }
}
