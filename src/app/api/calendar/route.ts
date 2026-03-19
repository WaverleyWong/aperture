import { google } from "googleapis";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

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

export async function GET() {
  try {
    const auth = getOAuth2Client();
    const calendar = google.calendar({ version: "v3", auth });

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfDay = new Date(startOfDay);
    endOfDay.setDate(endOfDay.getDate() + 1);

    const res = await calendar.events.list({
      calendarId: "waverley@bloklondon.com",
      timeMin: startOfDay.toISOString(),
      timeMax: endOfDay.toISOString(),
      singleEvents: true,
      orderBy: "startTime",
    });

    const events = (res.data.items || []).map((event) => {
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
      };
    });

    return NextResponse.json({ events });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Calendar API error:", message);
    return NextResponse.json({ events: [], error: message }, { status: 500 });
  }
}
