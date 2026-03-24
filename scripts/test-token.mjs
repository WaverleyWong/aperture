import { readFileSync } from "fs";

// Parse .env.local manually
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
}

const clientId = process.env.PERSONAL_GOOGLE_CLIENT_ID;
const clientSecret = process.env.PERSONAL_GOOGLE_CLIENT_SECRET;
const refreshToken = process.env.PERSONAL_GOOGLE_REFRESH_TOKEN;

console.log("Client ID:", clientId?.slice(0, 20) + "...");
console.log("Client Secret:", clientSecret?.slice(0, 10) + "...");
console.log("Refresh Token:", refreshToken?.slice(0, 20) + "...");
console.log("");

const params = new URLSearchParams({
  client_id: clientId,
  client_secret: clientSecret,
  refresh_token: refreshToken,
  grant_type: "refresh_token",
});

console.log("Requesting access token from Google...\n");

const res = await fetch("https://oauth2.googleapis.com/token", {
  method: "POST",
  headers: { "Content-Type": "application/x-www-form-urlencoded" },
  body: params.toString(),
});

const data = await res.json();
console.log("Status:", res.status);
console.log("Response:", JSON.stringify(data, null, 2));
