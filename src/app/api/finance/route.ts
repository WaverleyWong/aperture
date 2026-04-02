import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const CSV_URL = process.env.FINANCE_CSV_URL!;
const MONZO_ACCOUNT_ID = "acc_00009TQJALpHol2So7TGAD";

// Monzo token management — auto-refresh when expired
let monzoAccessToken = process.env.MONZO_ACCESS_TOKEN!;
let monzoRefreshToken = process.env.MONZO_REFRESH_TOKEN!;

async function getMonzoToken(): Promise<string> {
  // Try the current token first with a lightweight call
  const testRes = await fetch("https://api.monzo.com/ping/whoami", {
    headers: { Authorization: `Bearer ${monzoAccessToken}` },
  });

  if (testRes.ok) return monzoAccessToken;

  // Token expired — refresh it
  console.log("Monzo token expired, refreshing...");
  const params = new URLSearchParams({
    grant_type: "refresh_token",
    client_id: process.env.MONZO_CLIENT_ID!,
    client_secret: process.env.MONZO_CLIENT_SECRET!,
    refresh_token: monzoRefreshToken,
  });

  const refreshRes = await fetch("https://api.monzo.com/oauth2/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: params.toString(),
  });

  if (!refreshRes.ok) {
    const err = await refreshRes.text();
    console.error("Monzo token refresh failed:", err);
    throw new Error("Monzo token refresh failed");
  }

  const tokens = await refreshRes.json();
  monzoAccessToken = tokens.access_token;
  monzoRefreshToken = tokens.refresh_token;
  console.log("Monzo token refreshed successfully");
  return monzoAccessToken;
}

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

type MonzoTransaction = {
  id: string;
  amount: number;
  category: string;
  created: string;
  merchant?: { name: string } | null;
  description: string;
  decline_reason?: string;
  include_in_spending?: boolean;
};

async function fetchMonzoTransactions(): Promise<MonzoTransaction[]> {
  const token = await getMonzoToken();
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  let since: string = monthStart.toISOString();
  const allTxns: MonzoTransaction[] = [];

  // Paginate — Monzo caps at 100 per request
  while (true) {
    const url = `https://api.monzo.com/transactions?account_id=${MONZO_ACCOUNT_ID}&since=${since}&limit=100&expand[]=merchant`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` },
      cache: "no-store",
    });

    if (!res.ok) {
      console.error("Monzo API error:", res.status, await res.text());
      break;
    }

    const data = await res.json();
    const txns = data.transactions || [];
    if (txns.length === 0) break;

    allTxns.push(...txns);

    // Use last transaction ID as cursor for next page
    if (txns.length < 100) break;
    since = txns[txns.length - 1].id;
  }

  return allTxns;
}

function getWeekNumber(date: Date, monthStart: Date): number {
  const dayOfMonth = date.getDate();
  return Math.ceil(dayOfMonth / 7);
}

export async function GET() {
  try {
    const [csvRes, monzoTxns] = await Promise.all([
      fetch(`${CSV_URL}&_t=${Date.now()}`, { redirect: "follow", cache: "no-store" }),
      fetchMonzoTransactions(),
    ]);

    const text = await csvRes.text();
    const rows = parseCSV(text);

    // Read targets from sheet regardless of which month label it shows

    // ── Budget targets from Google Sheets ──

    // Weekly grocery targets (rows 8-11, index 7-10, col B)
    const weeklyGroceryTargets = [
      num(rows[7]?.[1]),
      num(rows[8]?.[1]),
      num(rows[9]?.[1]),
      num(rows[10]?.[1]),
    ];
    const monthlyGroceryTarget = weeklyGroceryTargets.reduce((a, b) => a + b, 0);

    // Weekly going out targets (rows 13-16, index 12-15, col B)
    const weeklyGoingOutTargets = [
      num(rows[12]?.[1]),
      num(rows[13]?.[1]),
      num(rows[14]?.[1]),
      num(rows[15]?.[1]),
    ];
    const monthlyGoingOutTarget = weeklyGoingOutTargets.reduce((a, b) => a + b, 0);

    // Monthly targets
    const selfCareTarget = num(rows[19]?.[1]);
    const travelTarget = num(rows[20]?.[1]);
    const treatTarget = num(rows[21]?.[1]);

    // Subscription expected amounts from sheet (rows 17-19, index 16-18, col B)
    const subExpected = {
      "Amazon Prime": num(rows[16]?.[1]),
      "Patreon": num(rows[17]?.[1]),
      "Spotify": num(rows[18]?.[1]),
    };

    // ── Aggregate Monzo transactions ──

    const now = new Date();
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
    const currentWeek = getWeekNumber(now, monthStart);
    const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
    const dayOfMonth = now.getDate();

    // Category buckets
    let groceriesTotal = 0;
    let goingOutTotal = 0;
    let selfCareTotal = 0;
    let travelTotal = 0;
    let treatTotal = 0;

    // Weekly breakdowns
    const groceriesByWeek: Record<number, number> = {};
    const goingOutByWeek: Record<number, number> = {};

    // Subscription detection
    const subCharges: Record<string, number | null> = {
      "Amazon Prime": null,
      "Patreon": null,
      "Spotify": null,
    };

    const subKeywords: Record<string, string[]> = {
      "Amazon Prime": ["amazon prime", "amzn prime", "amazon.co.uk prime"],
      "Patreon": ["patreon"],
      "Spotify": ["spotify"],
    };

    for (const txn of monzoTxns) {
      // Skip declined, non-spending, positive amounts, and pot transfers
      if (txn.decline_reason) continue;
      if (txn.include_in_spending === false) continue;
      if (txn.amount >= 0) continue;
      if (txn.category === "savings") continue;

      const spend = Math.abs(txn.amount) / 100; // pence to pounds
      const txnDate = new Date(txn.created);
      const week = getWeekNumber(txnDate, monthStart);

      const merchantName = (
        (txn.merchant && typeof txn.merchant === "object" ? txn.merchant.name : txn.description) || ""
      ).toLowerCase();

      // Check subscriptions — matched subs skip category buckets
      let isSub = false;
      for (const [subName, keywords] of Object.entries(subKeywords)) {
        if (keywords.some((kw) => merchantName.includes(kw))) {
          subCharges[subName] = spend;
          isSub = true;
        }
      }
      if (isSub) continue;

      // Category mapping
      switch (txn.category) {
        case "groceries":
          groceriesTotal += spend;
          groceriesByWeek[week] = (groceriesByWeek[week] || 0) + spend;
          break;
        case "eating_out":
        case "entertainment":
          goingOutTotal += spend;
          goingOutByWeek[week] = (goingOutByWeek[week] || 0) + spend;
          break;
        case "personal_care":
          selfCareTotal += spend;
          break;
        case "transport":
          travelTotal += spend;
          break;
        case "gifts":
        case "shopping":
          treatTotal += spend;
          break;
      }
    }

    // Calculate weeks elapsed for averages
    const weeksElapsed = Math.max(currentWeek, 1);

    // Weekly budget = monthly / 4 (consistent with sheet having 4 weekly rows)
    const weeklyGroceryBudget = weeklyGroceryTargets[0] || monthlyGroceryTarget / 4;
    const weeklyGoingOutBudget = weeklyGoingOutTargets[0] || monthlyGoingOutTarget / 4;

    // Current week spend
    const groceriesThisWeek = groceriesByWeek[currentWeek] || 0;
    const goingOutThisWeek = goingOutByWeek[currentWeek] || 0;

    // Weekly averages
    const groceriesWeeklyAvg = groceriesTotal / weeksElapsed;
    const goingOutWeeklyAvg = goingOutTotal / weeksElapsed;

    // Pace: where spending should be vs where it is (as fraction of monthly target)
    const monthProgress = dayOfMonth / daysInMonth;

    const weekly = {
      groceries: {
        thisWeek: Math.round(groceriesThisWeek * 100) / 100,
        weeklyAvg: Math.round(groceriesWeeklyAvg * 100) / 100,
        weeklyBudget: weeklyGroceryBudget,
        monthTotal: Math.round(groceriesTotal * 100) / 100,
        monthTarget: monthlyGroceryTarget,
      },
      goingOut: {
        thisWeek: Math.round(goingOutThisWeek * 100) / 100,
        weeklyAvg: Math.round(goingOutWeeklyAvg * 100) / 100,
        weeklyBudget: weeklyGoingOutBudget,
        monthTotal: Math.round(goingOutTotal * 100) / 100,
        monthTarget: monthlyGoingOutTarget,
      },
      monthProgress,
      currentWeek,
    };

    const monthly = [
      { label: "Self Care", spent: Math.round(selfCareTotal * 100) / 100, target: selfCareTarget },
      { label: "Travel", spent: Math.round(travelTotal * 100) / 100, target: travelTarget },
      { label: "Treat Spend", spent: Math.round(treatTotal * 100) / 100, target: treatTarget },
    ];

    const subscriptions = Object.entries(subExpected).map(([name, expected]) => ({
      name,
      expected,
      charged: subCharges[name],
    }));

    return NextResponse.json({ weekly, monthly, subscriptions });
  } catch (error: unknown) {
    console.error("Finance API error:", error);
    return NextResponse.json(
      { weekly: null, monthly: null, subscriptions: null, error: "Failed to load finance data" },
      { status: 500 }
    );
  }
}
