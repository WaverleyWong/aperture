import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const SNOWFLAKE_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTIFdfdIVSq8yQc4rfzS-YhewlF6ET9d_x9QS9GO29_OEH5abhwZpMcvpLwkdW61pctEtWVcT5O6Qq5/pub?gid=718206136&single=true&output=csv";

const META_ADS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS7WFUKw59l4BmCv_CHunN7a4dc0NKuQHxtoEH9ynnv8DSuanlQpxXlnyuMVgn7GDll4lzv6Vjz8of/pub?gid=1855868377&single=true&output=csv";

const GOOGLE_ADS_CSV =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vQS7WFUKw59l4BmCv_CHunN7a4dc0NKuQHxtoEH9ynnv8DSuanlQpxXlnyuMVgn7GDll4lzv6Vjz8of/pub?gid=165344445&single=true&output=csv";

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

async function fetchCSV(url: string): Promise<string[][]> {
  const res = await fetch(`${url}&_t=${Date.now()}`, {
    redirect: "follow",
    cache: "no-store",
  });
  return parseCSV(await res.text());
}

function parseMetaSpend(rows: string[][]): number {
  // Row 0 is header: Campaign name, Ad Name, Adset Name, Amount spent, ...
  // Sum "Amount spent" (col 3) across all data rows
  let total = 0;
  for (let i = 1; i < rows.length; i++) {
    total += num(rows[i]?.[3]);
  }
  return total;
}

function parseGoogleSpend(rows: string[][]): number {
  // Find the "Total: Account" summary row and read Cost (col 10)
  for (const row of rows) {
    if (row[0]?.includes("Total: Account") || row[0]?.includes("Total:")) {
      return num(row[10]);
    }
  }
  // Fallback: sum Cost column from individual campaign rows
  // Campaign rows start after the "Rows" header section
  let total = 0;
  let inRows = false;
  for (const row of rows) {
    if (row[0] === "Campaign status" && inRows) {
      // Second header = start of data rows
    }
    if (row[0] === "Rows") {
      inRows = true;
      continue;
    }
    if (inRows && row[0] && row[0] !== "Campaign status") {
      total += num(row[10]);
    }
  }
  return total;
}

export async function GET() {
  try {
    const [snowflakeRows, metaRows, googleRows] = await Promise.all([
      fetchCSV(SNOWFLAKE_CSV),
      fetchCSV(META_ADS_CSV),
      fetchCSV(GOOGLE_ADS_CSV),
    ]);

    // Snowflake: Row 4 (index 3) contains MTD totals
    // cols: _, _, TY Total Sales, LY Total Sales, TY SC90 Trials, LY SC90 Trials
    const mtdRow = snowflakeRows[3];
    const totalSalesTY = num(mtdRow?.[2]);
    const totalSalesLY = num(mtdRow?.[3]);
    const sc90TrialsTY = num(mtdRow?.[4]);
    const sc90TrialsLY = num(mtdRow?.[5]);

    // Find the last data row to determine the "as-of" date
    let asOfDate = "";
    for (let i = snowflakeRows.length - 1; i >= 5; i--) {
      const dateVal = snowflakeRows[i]?.[0];
      if (dateVal && /^\d{4}-\d{2}-\d{2}$/.test(dateVal)) {
        asOfDate = dateVal;
        break;
      }
    }

    // Ad spend from both platforms
    const metaSpend = parseMetaSpend(metaRows);
    const googleSpend = parseGoogleSpend(googleRows);
    const totalAdSpend = metaSpend + googleSpend;
    const blendedCAC = sc90TrialsTY > 0 ? totalAdSpend / sc90TrialsTY : 0;

    return NextResponse.json({
      totalSalesTY,
      totalSalesLY,
      sc90TrialsTY,
      sc90TrialsLY,
      asOfDate,
      metaSpend,
      googleSpend,
      totalAdSpend,
      blendedCAC,
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : "Unknown error";
    console.error("BLOK Metrics API error:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
