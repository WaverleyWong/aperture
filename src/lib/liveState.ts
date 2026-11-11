import { getDb } from "@/db/database";

/** Reads a JSON value from live_state, falling back when absent or corrupt. */
export async function readState<T>(key: string, fallback: T): Promise<T> {
  const res = await getDb().execute({
    sql: "SELECT value FROM live_state WHERE key = ?",
    args: [key],
  });
  if (res.rows.length === 0) return fallback;
  try {
    return JSON.parse(res.rows[0].value as string) as T;
  } catch {
    return fallback;
  }
}

export async function writeState(key: string, value: unknown): Promise<void> {
  await getDb().execute({
    sql: `INSERT INTO live_state (key, value, updated_at) VALUES (?, ?, datetime('now'))
          ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    args: [key, JSON.stringify(value)],
  });
}

/**
 * The mailbox digests refresh three times a day rather than on every page
 * load. The day splits into three 8-hour slots (London time); within a slot
 * the stored result is reused, so opening Aperture repeatedly costs nothing.
 */
export function currentSlot(): { date: string; slot: number } {
  const now = new Date();
  const date = now.toLocaleDateString("en-CA", { timeZone: "Europe/London" });
  const hour = Number(
    new Intl.DateTimeFormat("en-GB", {
      hour: "numeric",
      hourCycle: "h23",
      timeZone: "Europe/London",
    }).format(now)
  );
  return { date, slot: Math.floor((Number.isFinite(hour) ? hour : 0) / 8) };
}

interface Cached<T> {
  date: string;
  slot: number;
  data: T;
  fetchedAt: string;
}

/** Returns the stored payload when it belongs to the current slot. */
export async function readSlotCache<T>(key: string): Promise<T | null> {
  const cached = await readState<Cached<T> | null>(key, null);
  if (!cached) return null;
  const { date, slot } = currentSlot();
  return cached.date === date && cached.slot === slot ? cached.data : null;
}

export async function writeSlotCache<T>(key: string, data: T): Promise<void> {
  const { date, slot } = currentSlot();
  await writeState(key, { date, slot, data, fetchedAt: new Date().toISOString() });
}

export const CACHE_KEYS = {
  personalDigest: "cache_personal_digest",
  workDigest: "cache_work_digest",
  slackDigest: "cache_slack_digest",
} as const;
