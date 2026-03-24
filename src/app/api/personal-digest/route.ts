import { google } from "googleapis";
import Anthropic from "@anthropic-ai/sdk";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

function getPersonalOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.PERSONAL_GOOGLE_CLIENT_ID,
    process.env.PERSONAL_GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/callback`
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.PERSONAL_GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

type EmailSummary = {
  sender: string;
  subject: string;
  summary: string;
};

type DigestResult = {
  needsReply: EmailSummary[];
  fyi: EmailSummary[];
};

export async function GET() {
  try {
    const auth = getPersonalOAuth2Client();
    const gmail = google.gmail({ version: "v1", auth });

    // Build query: from yesterday start-of-day to now
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    yesterday.setHours(0, 0, 0, 0);
    const afterEpoch = Math.floor(yesterday.getTime() / 1000);
    const query = `in:inbox after:${afterEpoch}`;

    // Fetch message IDs (max 20)
    const listRes = await gmail.users.messages.list({
      userId: "me",
      q: query,
      maxResults: 20,
    });

    const messageIds = (listRes.data.messages || []).map((m) => m.id!);

    if (messageIds.length === 0) {
      return NextResponse.json({ needsReply: [], fyi: [], emailCount: 0 });
    }

    // Fetch message details in parallel
    const messages = await Promise.all(
      messageIds.map(async (id) => {
        const msg = await gmail.users.messages.get({
          userId: "me",
          id,
          format: "metadata",
          metadataHeaders: ["From", "Subject", "Date"],
        });

        const headers = msg.data.payload?.headers || [];
        const from = headers.find((h) => h.name === "From")?.value || "";
        const subject =
          headers.find((h) => h.name === "Subject")?.value || "(No subject)";
        const date = headers.find((h) => h.name === "Date")?.value || "";
        const snippet = msg.data.snippet || "";

        return { from, subject, date, snippet };
      })
    );

    // Build prompt for Claude
    const emailList = messages
      .map(
        (m, i) =>
          `[${i + 1}] From: ${m.from}\nSubject: ${m.subject}\nDate: ${m.date}\nPreview: ${m.snippet}\n`
      )
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
      emailCount: messages.length,
    });
  } catch (error: unknown) {
    console.error("Personal Digest API error:", error);
    return NextResponse.json({ error: "Failed to load personal digest" }, { status: 500 });
  }
}
