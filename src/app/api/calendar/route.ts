import { google } from "googleapis";
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

export async function GET() {
  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const timeMin = startOfDay.toISOString();
    const timeMax = endOfDay.toISOString();

    // Fetch all visible calendars
    const calListRes = await calendar.calendarList.list();
    const calendars = calListRes.data.items || [];

    // Fetch events from all calendars in parallel
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
          return (res.data.items || []).map((event) => ({
            event,
            source,
            calendarName: cal.summary || cal.id || "",
          }));
        } catch {
          // Skip calendars we can't read (e.g. holidays with restricted access)
          return [];
        }
      })
    );

    const allEvents = allEventArrays
      .flat()
      .map(({ event, source }) => {
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
      })
      .sort((a, b) => a.sortKey.localeCompare(b.sortKey));

    const events = allEvents.map(({ sortKey: _, ...rest }) => rest);

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Calendar API error:", message);
    return NextResponse.json({ events: [], error: message }, { status: 500 });
  }
}
