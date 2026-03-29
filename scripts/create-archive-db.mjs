#!/usr/bin/env node
/**
 * One-time script to create the "Aperture Archive" database in Notion.
 * Usage: node scripts/create-archive-db.mjs
 */
import { readFileSync } from "fs";
import { Client } from "@notionhq/client";

// Load .env.local
const envFile = readFileSync(".env.local", "utf-8");
for (const line of envFile.split("\n")) {
  const trimmed = line.trim();
  if (!trimmed || trimmed.startsWith("#")) continue;
  const idx = trimmed.indexOf("=");
  if (idx > 0) process.env[trimmed.slice(0, idx)] = trimmed.slice(idx + 1);
}

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Check if it already exists
const search = await notion.search({ query: "Aperture Archive" });
const existing = search.results.find(
  (r) => r.object === "database" && r.title?.[0]?.plain_text === "Aperture Archive"
);

if (existing) {
  console.log(`Database already exists!`);
  console.log(`\nNOTION_ARCHIVE_DB_ID=${existing.id}\n`);
  process.exit(0);
}

// Find a page we can use as parent
const pages = search.results.filter((r) => r.object === "page");

// Also search for any accessible page
const allPages = await notion.search({
  filter: { property: "object", value: "page" },
});

const parentPage = allPages.results[0];
if (!parentPage) {
  console.error("No accessible pages found. Please:");
  console.log("1. Create a page called 'Aperture Archive' in Notion");
  console.log("2. Share it with the 'Aperture Dashboard' integration");
  console.log("3. Create a database inside it with properties: Name (title), Date (date), Tags (multi-select)");
  console.log("4. Copy the database ID and add to .env.local as NOTION_ARCHIVE_DB_ID");
  process.exit(1);
}

console.log(`Using parent page: "${parentPage.properties?.title?.title?.[0]?.plain_text || parentPage.id}"`);

try {
  const db = await notion.databases.create({
    parent: { type: "page_id", page_id: parentPage.id },
    title: [{ type: "text", text: { content: "Aperture Archive" } }],
    properties: {
      Name: { title: {} },
      Date: { date: {} },
      Tags: { multi_select: { options: [] } },
    },
  });
  console.log(`\n✅ Created "Aperture Archive" database!`);
  console.log(`\nNOTION_ARCHIVE_DB_ID=${db.id}\n`);
  console.log("Add this line to .env.local");
} catch (err) {
  console.error("Failed to create database:", err.message);
  console.log("\nCreate it manually in Notion:");
  console.log("1. Create a new database called 'Aperture Archive'");
  console.log("2. Properties: Name (title), Date (date), Tags (multi-select)");
  console.log("3. Share with 'Aperture Dashboard' integration");
  console.log("4. Add database ID to .env.local as NOTION_ARCHIVE_DB_ID");
}
