/**
 * Run this once to get a Google OAuth2 refresh token.
 *
 * Usage:
 *   npx tsx scripts/get-refresh-token.ts
 *
 * Prerequisites:
 *   1. Go to https://console.cloud.google.com
 *   2. Create a project (or use an existing one)
 *   3. Enable the "Google Calendar API"
 *   4. Go to Credentials → Create Credentials → OAuth client ID
 *      - Application type: Web application
 *      - Authorized redirect URIs: http://localhost:3000/api/calendar/callback
 *   5. Copy the Client ID and Client Secret into .env.local:
 *        GOOGLE_CLIENT_ID=...
 *        GOOGLE_CLIENT_SECRET=...
 *   6. Run this script — it will open a browser for you to authorize,
 *      then print the refresh token to add to .env.local.
 */

import { google } from "googleapis";
import http from "http";
import open from "open";

const CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error(
    "Missing GOOGLE_CLIENT_ID or GOOGLE_CLIENT_SECRET.\n" +
      "Add them to .env.local and run:\n" +
      "  source <(grep -v '^#' .env.local | sed 's/^/export /') && npx tsx scripts/get-refresh-token.ts"
  );
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(
  CLIENT_ID,
  CLIENT_SECRET,
  "http://localhost:3099/callback"
);

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: [
    "https://www.googleapis.com/auth/calendar.readonly",
    "https://www.googleapis.com/auth/gmail.readonly",
  ],
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, "http://localhost:3099");
  const code = url.searchParams.get("code");

  if (!code) {
    res.writeHead(400);
    res.end("Missing code parameter");
    return;
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    console.log("\n✅ Add this to your .env.local:\n");
    console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}\n`);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h1>Done! You can close this tab.</h1><p>Check the terminal for your refresh token.</p>");
  } catch (err) {
    console.error("Error getting token:", err);
    res.writeHead(500);
    res.end("Error getting token");
  }

  server.close();
});

server.listen(3099, () => {
  console.log("Opening browser for authorization...");
  open(authUrl);
});
