import { google } from "googleapis";

/**
 * The "work" Google connection — one OAuth app plus one signed-in account,
 * shared by the work calendar (Today's Activities) and the work email digest.
 *
 * WORK_DOMAIN is the email domain of that account, used to tell work calendars
 * apart from any personal ones visible on the same login. Treat it as the
 * switch for the whole work side: with it unset, nothing work-related loads.
 */
export interface WorkConfig {
  clientId: string;
  clientSecret: string;
  refreshToken: string;
  domain: string;
}

/**
 * Returns null when the work connection isn't fully configured. Callers must
 * treat null as "show nothing", never as an error — a half-configured or
 * absent work account is a normal state, not a failure.
 */
export function getWorkConfig(): WorkConfig | null {
  const domain = process.env.WORK_DOMAIN?.trim();
  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
  const refreshToken = process.env.GOOGLE_REFRESH_TOKEN;

  if (!domain || !clientId || !clientSecret || !refreshToken) return null;

  return { clientId, clientSecret, refreshToken, domain };
}

export function createWorkOAuth2Client(config: WorkConfig) {
  const oauth2Client = new google.auth.OAuth2(
    config.clientId,
    config.clientSecret,
    `${process.env.NEXT_PUBLIC_BASE_URL}/api/calendar/callback`
  );
  oauth2Client.setCredentials({ refresh_token: config.refreshToken });
  return oauth2Client;
}

/** True when a calendar belongs to the work domain rather than a personal one. */
export function isWorkCalendar(calendarId: string, domain: string): boolean {
  return (
    calendarId.endsWith(`@${domain}`) || calendarId.endsWith(`.${domain}`)
  );
}
