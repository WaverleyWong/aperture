import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vSgzddtRP1SLEHf2EX17va8duRsMv0D09a79TgD2D6XubKJNKK9z5XSsBIyA_hssie7HJ1TDhmu0Qp7/pub?output=csv";

function parseCSV(text: string): string[][] {
  const rows: string[][] = [];
  let current = "";
  let inQuotes = false;
  let row: string[] = [];

  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        current += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ",") {
        row.push(current.trim());
        current = "";
      } else if (ch === "\n" || (ch === "\r" && text[i + 1] === "\n")) {
        row.push(current.trim());
        rows.push(row);
        row = [];
        current = "";
        if (ch === "\r") i++;
      } else {
        current += ch;
      }
    }
  }
  // Last row
  if (current || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function num(val: string | undefined): number {
  if (!val) return 0;
  // Strip £, commas, whitespace
  const cleaned = val.replace(/[£,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export async function GET() {
  try {
    const res = await fetch(`${CSV_URL}&_t=${Date.now()}`, { redirect: "follow", cache: "no-store" });
    const text = await res.text();
    const rows = parseCSV(text);

    // Row 4 (index 3): month in col C (index 2)
    const sheetMonth = (rows[3]?.[2] || "").toLowerCase();
    const currentMonth = new Date().toLocaleString("en-GB", { month: "long" }).toLowerCase();

    if (sheetMonth !== currentMonth) {
      return NextResponse.json({
        match: false,
        sheetMonth: rows[3]?.[2] || "unknown",
        categories: [],
      });
    }

    // Grocery target: sum weekly targets (rows 8-11, index 7-10, col B)
    const groceryTarget =
      num(rows[7]?.[1]) + num(rows[8]?.[1]) + num(rows[9]?.[1]) + num(rows[10]?.[1]);
    const grocerySpent = num(rows[6]?.[2]); // Row 7, col C

    // Going Out target: sum weekly targets (rows 13-16, index 12-15, col B)
    const socialTarget =
      num(rows[12]?.[1]) + num(rows[13]?.[1]) + num(rows[14]?.[1]) + num(rows[15]?.[1]);
    const socialSpent = num(rows[11]?.[2]); // Row 12, col C

    // Self Care: row 20 (index 19), col B = target, col C = spent
    const selfCareTarget = num(rows[19]?.[1]);
    const selfCareSpent = num(rows[19]?.[2]);

    // Travel: row 21 (index 20), col B = target, col C = spent
    const travelTarget = num(rows[20]?.[1]);
    const travelSpent = num(rows[20]?.[2]);

    // Treat Spend: row 22 (index 21), col B = target, col C = spent
    const treatTarget = num(rows[21]?.[1]);
    const treatSpent = num(rows[21]?.[2]);

    const categories = [
      { label: "Groceries", spent: grocerySpent, target: groceryTarget },
      { label: "Going Out", spent: socialSpent, target: socialTarget },
      { label: "Self Care", spent: selfCareSpent, target: selfCareTarget },
      { label: "Travel", spent: travelSpent, target: travelTarget },
      { label: "Treat Spend", spent: treatSpent, target: treatTarget },
    ];

    return NextResponse.json({ match: true, categories });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("Finance API error:", message);
    return NextResponse.json({ categories: [], error: message }, { status: 500 });
  }
}
