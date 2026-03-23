import { google } from "googleapis";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { StdioClientTransport } from "@modelcontextprotocol/sdk/client/stdio.js";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORK_DOMAIN = "bloklondon.com";

function getOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    "http://localhost:3000/api/calendar/callback"
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

function classifyCalendar(calendarId: string): "work" | "personal" {
  if (calendarId.endsWith(`@${WORK_DOMAIN}`) || calendarId.endsWith(`.${WORK_DOMAIN}`)) {
    return "work";
  }
  return "personal";
}

type CalendarEvent = {
  time: string;
  label: string;
  isAllDay: boolean;
  source: "work" | "personal";
  sortKey: string;
};

async function fetchWorkEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
  const auth = getOAuth2Client();
  const calendar = google.calendar({ version: "v3", auth });

  const calListRes = await calendar.calendarList.list();
  const calendars = calListRes.data.items || [];

  const allEventArrays = await Promise.all(
    calendars.map(async (cal) => {
      try {
        const res = await calendar.events.list({
          calendarId: cal.id!,
          timeMin,
          timeMax,
          singleEvents: true,
          orderBy: "startTime",
        });
        const source = classifyCalendar(cal.id || "");
        return (res.data.items || []).map((event) => {
          const start = event.start?.dateTime || event.start?.date || "";
          const isAllDay = !event.start?.dateTime;
          let time = "All day";
          if (!isAllDay && start) {
            time = new Date(start).toLocaleTimeString("en-GB", {
              hour: "2-digit",
              minute: "2-digit",
              hour12: false,
            });
          }
          return {
            time,
            label: event.summary || "(No title)",
            isAllDay,
            source,
            sortKey: isAllDay ? "00:00" : time,
          };
        });
      } catch {
        return [];
      }
    })
  );

  return allEventArrays.flat();
}

type McpCalendarEvent = {
  summary?: string;
  start?: { dateTime?: string; date?: string; timeZone?: string };
  end?: { dateTime?: string; date?: string };
  status?: string;
};

async function fetchPersonalEvents(timeMin: string, timeMax: string): Promise<CalendarEvent[]> {
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

  const client = new Client({ name: "aperture-calendar", version: "1.0.0" });

  try {
    await client.connect(transport);

    const result = await client.callTool({
      name: "calendar_get_events",
      arguments: {
        user_id: "waverleybrontewong@gmail.com",
        time_min: timeMin,
        time_max: timeMax,
        timezone: "Europe/London",
      },
    });

    const textBlock = Array.isArray(result.content)
      ? result.content.find((c: { type: string }) => c.type === "text")
      : null;

    if (!textBlock || textBlock.type !== "text") {
      return [];
    }

    const events: McpCalendarEvent[] = JSON.parse(textBlock.text);

    return events
      .filter((e) => e.status !== "cancelled")
      .map((event) => {
        const start = event.start?.dateTime || event.start?.date || "";
        const isAllDay = !event.start?.dateTime;
        let time = "All day";
        if (!isAllDay && start) {
          time = new Date(start).toLocaleTimeString("en-GB", {
            hour: "2-digit",
            minute: "2-digit",
            hour12: false,
          });
        }
        return {
          time,
          label: event.summary || "(No title)",
          isAllDay,
          source: "personal" as const,
          sortKey: isAllDay ? "00:00" : time,
        };
      });
  } finally {
    await client.close();
  }
}

export async function GET() {
  try {
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();

    // Fetch work and personal calendars in parallel
    const [workEvents, personalEvents] = await Promise.all([
      fetchWorkEvents(timeMin, timeMax),
      fetchPersonalEvents(timeMin, timeMax).catch((err) => {
        console.error("Personal calendar fetch failed:", err);
        return [] as CalendarEvent[];
      }),
    ]);

    // Merge, deduplicate by label+time, and sort
    const seen = new Set<string>();
    const merged = [...workEvents, ...personalEvents].filter((e) => {
      const key = `${e.label}::${e.time}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sorted = merged.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
    const events = sorted.map(({ sortKey: _, ...rest }) => rest);

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Calendar API error:", message);
    return NextResponse.json({ events: [], error: message }, { status: 500 });
  }
}
