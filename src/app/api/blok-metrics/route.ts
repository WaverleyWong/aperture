import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIFdfdIVSq8yQc4rfzS-YhewlF6ET9d_x9QS9GO29_OEH5abhwZpMcvpLwkdW61pctEtWVcT5O6Qq5/pub?gid=718206136&single=true&output=csv";

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
  if (current || row.length > 0) {
    row.push(current.trim());
    rows.push(row);
  }
  return rows;
}

function num(val: string | undefined): number {
  if (!val) return 0;
  const cleaned = val.replace(/[£,\s]/g, "");
  const n = parseFloat(cleaned);
  return isNaN(n) ? 0 : n;
}

export async function GET() {
  try {
    const res = await fetch(`${CSV_URL}&_t=${Date.now()}`, {
      redirect: "follow",
      cache: "no-store",
    });
    const text = await res.text();
    const rows = parseCSV(text);

    // Row 4 (index 3) contains MTD totals:
    // cols: _, _, TY Total Sales, LY Total Sales, TY SC90 Trials, LY SC90 Trials
    const mtdRow = rows[3];
    const totalSalesTY = num(mtdRow?.[2]);
    const totalSalesLY = num(mtdRow?.[3]);
    const sc90TrialsTY = num(mtdRow?.[4]);
    const sc90TrialsLY = num(mtdRow?.[5]);

    // Find the last data row to determine the "as-of" date
    // Data rows start at index 5 (row 6) — format: 2026-03-01, 1, ...
    let asOfDate = "";
    for (let i = rows.length - 1; i >= 5; i--) {
      const dateVal = rows[i]?.[0];
      if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        asOfDate = dateVal;
        break;
      }
    }

    return NextResponse.json({
      totalSalesTY,
      totalSalesLY,
      sc90TrialsTY,
      sc90TrialsLY,
      asOfDate,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("BLOK Metrics API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
