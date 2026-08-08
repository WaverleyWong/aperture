// Week Log date helpers. Weeks run Monday to Sunday.
// All dates are 'YYYY-MM-DD' strings, never timestamps — BST/GMT never touches them.

// The only place a timezone matters: resolving "today" when writing a row.
export function getTodayLondonISO(): string {
  // en-CA formats as YYYY-MM-DD
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London" }).format(new Date());
}

// Parse a date string at midday UTC so day-of-month never shifts under a timezone offset.
function parseISO(iso: string): Date {
  return new Date(`${iso}T12:00:00Z`);
}

function toISO(d: Date): string {
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}-${String(d.getUTCDate()).padStart(2, "0")}`;
}

export function addDaysISO(iso: string, days: number): string {
  const d = parseISO(iso);
  d.setUTCDate(d.getUTCDate() + days);
  return toISO(d);
}

// Monday of the week containing `iso`. Mirrors the SQL bucketing expression.
export function getWeekStartISO(iso: string): string {
  const dow = parseISO(iso).getUTCDay(); // 0 = Sunday
  return addDaysISO(iso, -((dow + 6) % 7));
}

// "Mon 3 – Sun 9 Aug" — month repeated on the start only when the week spans two months.
export function formatWeekRange(weekStartISO: string): string {
  const start = parseISO(weekStartISO);
  const end = parseISO(addDaysISO(weekStartISO, 6));
  const sameMonth = start.getUTCMonth() === end.getUTCMonth();

  const startLabel = start.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    ...(sameMonth ? {} : { month: "short" }),
    timeZone: "UTC",
  });
  const endLabel = end.toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });

  return `${startLabel} – ${endLabel}`;
}

// "Monday 3 Aug"
export function formatDayHeading(iso: string): string {
  return parseISO(iso).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  });
}

export type WeekEntry = {
  id: number;
  entryDate: string;
  title: string;
  notionPageId?: string;
};

export type WeekDay = { date: string; entries: WeekEntry[] };

// Monday to Sunday, days with no entries omitted
export function groupByDay(weekStartISO: string, entries: WeekEntry[]): WeekDay[] {
  const days: WeekDay[] = [];
  for (let i = 0; i < 7; i++) {
    const date = addDaysISO(weekStartISO, i);
    const forDay = entries.filter((e) => e.entryDate === date);
    if (forDay.length > 0) days.push({ date, entries: forDay });
  }
  return days;
}

export function buildMarkdown(weekStartISO: string, days: WeekDay[]): string {
  const lines: string[] = [`## ${formatWeekRange(weekStartISO)}`, ""];
  for (const day of days) {
    lines.push(`**${formatDayHeading(day.date)}**`);
    for (const entry of day.entries) lines.push(`- ${entry.title}`);
    lines.push("");
  }
  return lines.join("\n").trimEnd();
}
