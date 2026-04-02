import { google } from "googleapis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const WORK_DOMAIN = "bloklondon.com";

function getWorkOAuth2Client() {
  const oauth2Client = new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/callback`
  );
  oauth2Client.setCredentials({
    refresh_token: process.env.GOOGLE_REFRESH_TOKEN,
  });
  return oauth2Client;
}

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

function formatEvent(
  event: {
    start?: { dateTime?: string | null; date?: string | null; timeZone?: string | null };
    summary?: string | null;
  },
  source: "work" | "personal"
): CalendarEvent {
  const start = event.start?.dateTime || event.start?.date || "";
  const isAllDay = !event.start?.dateTime;
  let time = "All day";
  if (!isAllDay && start) {
    time = new Date(start).toLocaleTimeString("en-GB", {
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
      timeZone: "Europe/London",
    });
  }
  return {
    time,
    label: event.summary || "(No title)",
    isAllDay,
    source,
    sortKey: isAllDay ? "00:00" : time,
  };
}

async function fetchCalendarEvents(
  auth: ReturnType<typeof getWorkOAuth2Client>,
  timeMin: string,
  timeMax: string,
  sourceOverride?: "work" | "personal"
): Promise<CalendarEvent[]> {
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
          timeZone: "Europe/London",
          singleEvents: true,
          orderBy: "startTime",
        });
        const source = sourceOverride || classifyCalendar(cal.id || "");
        return (res.data.items || []).map((event) => formatEvent(event, source));
      } catch {
        return [];
      }
    })
  );

  return allEventArrays.flat();
}

export async function GET() {
  try {
    // Get today's date in London and build proper RFC3339 boundaries
    const now = new Date();
    const londonDate = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" }); // YYYY-MM-DD
    // Compute London's UTC offset by comparing formatted times
    const utcHour = now.getUTCHours();
    const londonHour = parseInt(new Intl.DateTimeFormat("en-GB", { hour: "numeric", hour12: false, timeZone: "Europe/London" }).format(now), 10);
    let offsetHours = londonHour - utcHour;
    if (offsetHours > 12) offsetHours -= 24;
    if (offsetHours < -12) offsetHours += 24;
    const sign = offsetHours >= 0 ? "+" : "-";
    const offsetStr = `${sign}${String(Math.abs(offsetHours)).padStart(2, "0")}:00`;

    const timeMin = `${londonDate}T00:00:00${offsetStr}`;
    const timeMax = `${londonDate}T23:59:59${offsetStr}`;

    // Fetch work and personal calendars in parallel
    const [workEvents, personalEvents] = await Promise.all([
      fetchCalendarEvents(getWorkOAuth2Client(), timeMin, timeMax),
      fetchCalendarEvents(getPersonalOAuth2Client(), timeMin, timeMax, "personal").catch((err) => {
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
    console.error("Calendar API error:", error);
    return NextResponse.json({ events: [], error: "Failed to load calendar" }, { status: 500 });
  }
}
