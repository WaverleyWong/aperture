#!/usr/bin/env node
/**
 * One-time script to get a fresh Google OAuth2 refresh token.
 * Opens a browser, lets you sign in, and prints the refresh token.
 *
 * Usage: node scripts/get-refresh-token.mjs
 */

import { google } from "googleapis";
import http from "node:http";
import { execSync } from "node:child_process";

// Read .env.local for credentials
import { readFileSync } from "node:fs";
try {
  const envFile = readFileSync(".env.local", "utf-8");
  for (const line of envFile.split("\n")) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const idx = trimmed.indexOf("=");
    if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
  }
} catch {
  console.error("Could not read .env.local — make sure it exists in the project root.");
  process.exit(1);
}

const CLIENT_ID = process.env.PERSONAL_GOOGLE_CLIENT_ID;
const CLIENT_SECRET = process.env.PERSONAL_GOOGLE_CLIENT_SECRET;
const REDIRECT_URI = "http://localhost:3847/callback";

if (!CLIENT_ID || !CLIENT_SECRET) {
  console.error("Missing PERSONAL_GOOGLE_CLIENT_ID or PERSONAL_GOOGLE_CLIENT_SECRET in .env.local");
  process.exit(1);
}

const oauth2Client = new google.auth.OAuth2(CLIENT_ID, CLIENT_SECRET, REDIRECT_URI);

const scopes = [
  "https://www.googleapis.com/auth/calendar.readonly",
  "https://www.googleapis.com/auth/gmail.readonly",
];

const authUrl = oauth2Client.generateAuthUrl({
  access_type: "offline",
  prompt: "consent",
  scope: scopes,
  login_hint: "waverleybrontewong@gmail.com",
});

const server = http.createServer(async (req, res) => {
  if (!req.url?.startsWith("/callback")) return;

  const url = new URL(req.url, `http://localhost:3847`);
  const code = url.searchParams.get("code");
  const error = url.searchParams.get("error");

  if (error) {
    res.writeHead(400, { "Content-Type": "text/html" });
    res.end(`<h2>Error: ${error}</h2><p>You can close this tab.</p>`);
    console.error("OAuth error:", error);
    server.close();
    process.exit(1);
  }

  try {
    const { tokens } = await oauth2Client.getToken(code);
    res.writeHead(200, { "Content-Type": "text/html" });
    res.end("<h2>Success! You can close this tab.</h2>");

    console.log("\n✅  Got tokens!\n");
    console.log("PERSONAL_GOOGLE_REFRESH_TOKEN=" + tokens.refresh_token);
    console.log("\nPaste the line above into .env.local to replace the old value.\n");
  } catch (err) {
    res.writeHead(500, { "Content-Type": "text/html" });
    res.end(`<h2>Token exchange failed</h2><pre>${err.message}</pre>`);
    console.error("Token exchange failed:", err.message);
  }

  server.close();
});

server.listen(3847, () => {
  console.log("Listening on http://localhost:3847 for OAuth callback...");
  console.log("Opening browser for Google sign-in...\n");
  execSync(`open "${authUrl}"`);
});
