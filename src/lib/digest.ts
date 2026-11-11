import Anthropic from "@anthropic-ai/sdk";
import { getDb } from "@/db/database";
import { runMigrations } from "@/db/migrate";
import { getTodayLondonISO } from "@/lib/week";
import { DEFAULT_SOURCES, SEED_PROFILE, type DigestSource } from "@/lib/digestSources";
import { fetchFeed, fetchOgImage, type FeedItem } from "@/lib/feeds";
import { readState, writeState } from "@/lib/liveState";

export { readState, writeState };

// ── Tuning ──
const WINDOW_HOURS = 36;
const MATCHED_CARDS = 8;
const WILDCARD_CARDS = 2;
/** No single source may dominate the day. */
const MAX_PER_SOURCE = 2;
/** An article shown in this many past days is never shown again. */
const NO_REPEAT_DAYS = 7;
/** Consecutive bad days before a source is flagged in the editor. */
const UNHEALTHY_STREAK = 3;
/** Cap per source so one busy feed can't swamp the prompt. */
const CANDIDATES_PER_SOURCE = 8;
const PROFILE_HISTORY_LIMIT = 12;

export const STATE = {
  cards: "digest_cards",
  sources: "digest_sources",
  health: "digest_health",
  shown: "digest_shown",
  profile: "digest_profile",
  profileHistory: "digest_profile_history",
  suggestions: "digest_suggestions",
} as const;

export interface DigestCard {
  url: string;
  headline: string;
  source: string;
  sourceId: string;
  image: string | null;
  reason: string;
  topic: string;
  wildcard: boolean;
}

export interface SourceHealth {
  lastSuccess: string | null;
  lastCount: number;
  failStreak: number;
  lastError?: string;
}

interface ShownEntry {
  url: string;
  date: string;
}

// ── live_state helpers live in @/lib/liveState ──

export async function getSources(): Promise<DigestSource[]> {
  const stored = await readState<DigestSource[] | null>(STATE.sources, null);
  if (Array.isArray(stored) && stored.length > 0) return stored;
  // First run — seed the editable list from the defaults.
  await writeState(STATE.sources, DEFAULT_SOURCES);
  return DEFAULT_SOURCES;
}

export async function getProfile(): Promise<string> {
  const stored = await readState<{ text?: string } | null>(STATE.profile, null);
  return stored?.text?.trim() || SEED_PROFILE;
}

// ── Fetching ──

interface Candidate {
  item: FeedItem;
  source: DigestSource;
}

async function fetchSource(
  source: DigestSource
): Promise<{ items: FeedItem[]; ok: boolean; error?: string }> {
  let result = await fetchFeed(source.url);

  // Hot Dinners' primary feed is a fragile Joomla URL; swap to the backup
  // when it errors *or* silently returns an empty channel.
  if ((!result.ok || result.items.length === 0) && source.fallbackUrl) {
    const fallback = await fetchFeed(source.fallbackUrl);
    if (fallback.ok && fallback.items.length > 0) result = fallback;
  }

  return result;
}

// ── Generation ──

export interface GenerateResult {
  cards: DigestCard[];
  generatedAt: string;
  candidateCount: number;
  profileRewritten: boolean;
}

export async function generateDigest(): Promise<GenerateResult> {
  await runMigrations();

  const today = getTodayLondonISO();
  const sources = await getSources();
  const health = await readState<Record<string, SourceHealth>>(STATE.health, {});
  const shown = await readState<ShownEntry[]>(STATE.shown, []);

  const cutoff = Date.now() - WINDOW_HOURS * 60 * 60 * 1000;
  const repeatCutoff = Date.now() - NO_REPEAT_DAYS * 24 * 60 * 60 * 1000;
  const recentlyShown = new Set(
    shown.filter((s) => Date.parse(s.date) >= repeatCutoff).map((s) => s.url)
  );

  const results = await Promise.all(
    sources.map(async (source) => ({ source, result: await fetchSource(source) }))
  );

  const candidates: Candidate[] = [];
  for (const { source, result } of results) {
    const prior = health[source.id] || { lastSuccess: null, lastCount: 0, failStreak: 0 };
    const usable = result.ok && result.items.length > 0;

    health[source.id] = usable
      ? { lastSuccess: new Date().toISOString(), lastCount: result.items.length, failStreak: 0 }
      : {
          ...prior,
          lastCount: result.items.length,
          failStreak: prior.failStreak + 1,
          lastError: result.error || "returned no items",
        };

    const fresh = result.items
      .filter((item) => item.published === null || item.published >= cutoff)
      .filter((item) => !recentlyShown.has(item.link))
      .slice(0, CANDIDATES_PER_SOURCE);

    for (const item of fresh) candidates.push({ item, source });
  }

  await writeState(STATE.health, health);

  if (candidates.length === 0) {
    const empty: GenerateResult = {
      cards: [],
      generatedAt: new Date().toISOString(),
      candidateCount: 0,
      profileRewritten: false,
    };
    await writeState(STATE.cards, { date: today, generatedAt: empty.generatedAt, cards: [] });
    return empty;
  }

  const matchedPool = candidates.filter((c) => !c.source.wildcard);
  const wildcardPool = candidates.filter((c) => c.source.wildcard);

  const picks = await chooseCards(matchedPool, wildcardPool, await getProfile(), await recentReactions());

  const cards = await buildCards(picks, matchedPool, wildcardPool);

  const generatedAt = new Date().toISOString();
  await writeState(STATE.cards, { date: today, generatedAt, cards });

  // Remember what was shown so it can't reappear for a week.
  const nextShown = [
    ...shown.filter((s) => Date.parse(s.date) >= repeatCutoff),
    ...cards.map((c) => ({ url: c.url, date: new Date().toISOString() })),
  ];
  await writeState(STATE.shown, nextShown);

  let profileRewritten = false;
  // Monday — rewrite the taste profile from real reactions.
  if (new Date(`${today}T12:00:00`).getUTCDay() === 1) {
    profileRewritten = await rewriteProfile();
  }
  await refreshSuggestions(sources);

  return { cards, generatedAt, candidateCount: candidates.length, profileRewritten };
}

// ── Claude picks by index, never by URL ──

interface Pick {
  index: number;
  reason: string;
  topic: string;
}

const PICK_SCHEMA = {
  type: "object",
  properties: {
    picks: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          reason: { type: "string" },
          topic: { type: "string" },
        },
        required: ["index", "reason", "topic"],
        additionalProperties: false,
      },
    },
    wildcards: {
      type: "array",
      items: {
        type: "object",
        properties: {
          index: { type: "integer" },
          reason: { type: "string" },
          topic: { type: "string" },
        },
        required: ["index", "reason", "topic"],
        additionalProperties: false,
      },
    },
  },
  required: ["picks", "wildcards"],
  additionalProperties: false,
};

function describe(pool: Candidate[]): string {
  return pool
    .map(
      (c, i) =>
        `[${i}] (${c.source.name} · ${c.source.category}) ${c.item.title}${
          c.item.summary ? `\n    ${c.item.summary.slice(0, 220)}` : ""
        }`
    )
    .join("\n");
}

async function chooseCards(
  matched: Candidate[],
  wildcard: Candidate[],
  profile: string,
  reactions: string
): Promise<{ picks: Pick[]; wildcards: Pick[] }> {
  const anthropic = new Anthropic();

  const response = await anthropic.messages.create({
    model: "claude-sonnet-5",
    // Thinking is on by default and shares this budget with the response.
    max_tokens: 4000,
    output_config: {
      effort: "medium",
      format: { type: "json_schema", schema: PICK_SCHEMA },
    },
    messages: [
      {
        role: "user",
        content: `Curate today's news cards for Waverley's personal dashboard.

Pick exactly ${MATCHED_CARDS} items from the MATCHED list and exactly ${WILDCARD_CARDS} from the WILDCARD list.

Return the index number of each item — never a URL, never a headline you've written yourself. Only indices that appear below.

Her taste profile:
${profile}

${reactions}

Rules:
- At most ${MAX_PER_SOURCE} items from any single source, so a high-volume feed can't crowd out a quiet one.
- Food is weighted heaviest; after that follow the profile.
- Prefer specific, substantial pieces over press-release churn, listicles and hype.
- Spread across her interests rather than ${MATCHED_CARDS} items on one topic.
- Wildcards are deliberately outside her usual lane — interesting, not random.
- "reason" is one short line on why this is here, addressed to her, no preamble. Under 90 characters.
- "topic" is one or two lowercase words (e.g. "london restaurants", "indie dev", "ai tooling").

MATCHED:
${describe(matched)}

WILDCARD:
${describe(wildcard)}`,
      },
    ],
  });

  if (response.stop_reason === "refusal") {
    console.error("Digest curation declined by safety classifier.");
    return { picks: [], wildcards: [] };
  }

  const block = response.content.find((b) => b.type === "text");
  const text = block && block.type === "text" ? block.text : "";
  try {
    const parsed = JSON.parse(text) as { picks?: Pick[]; wildcards?: Pick[] };
    return { picks: parsed.picks || [], wildcards: parsed.wildcards || [] };
  } catch {
    console.error("Digest curation returned unparseable output.");
    return { picks: [], wildcards: [] };
  }
}

// ── Turning picks back into real articles ──

async function buildCards(
  chosen: { picks: Pick[]; wildcards: Pick[] },
  matched: Candidate[],
  wildcard: Candidate[]
): Promise<DigestCard[]> {
  const perSource = new Map<string, number>();
  const seen = new Set<string>();
  const cards: DigestCard[] = [];

  const take = (picks: Pick[], pool: Candidate[], isWildcard: boolean, limit: number) => {
    for (const pick of picks) {
      if (cards.filter((c) => c.wildcard === isWildcard).length >= limit) break;

      const candidate = pool[pick.index];
      // An out-of-range index is dropped rather than guessed at.
      if (!candidate || seen.has(candidate.item.link)) continue;

      const used = perSource.get(candidate.source.id) || 0;
      if (used >= MAX_PER_SOURCE) continue;

      seen.add(candidate.item.link);
      perSource.set(candidate.source.id, used + 1);
      cards.push({
        url: candidate.item.link,
        headline: candidate.item.title,
        source: candidate.source.name,
        sourceId: candidate.source.id,
        image: candidate.item.image,
        reason: (pick.reason || "").slice(0, 120),
        topic: (pick.topic || candidate.source.category).slice(0, 40),
        wildcard: isWildcard,
      });
    }
  };

  take(chosen.picks, matched, false, MATCHED_CARDS);
  take(chosen.wildcards, wildcard, true, WILDCARD_CARDS);

  // Only now, for cards that actually made it, go looking for missing images.
  await Promise.all(
    cards.map(async (card) => {
      if (!card.image) card.image = await fetchOgImage(card.url);
    })
  );

  return cards;
}

// ── Taste ──

async function recentReactions(): Promise<string> {
  const db = getDb();
  const since = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const res = await db.execute({
    sql: `SELECT headline, source, topic, reaction FROM digest_reactions
          WHERE entry_date >= ? ORDER BY created_at DESC LIMIT 60`,
    args: [since],
  });

  if (res.rows.length === 0) return "No reactions recorded yet — lean on the profile.";

  const lines = res.rows.map(
    (r) => `- ${r.reaction}: "${r.headline}" (${r.source}, ${r.topic || "—"})`
  );
  return `Her reactions over the last two weeks ("more" = want more like this, "less" = want less, "open" = clicked through, a weak positive):\n${lines.join("\n")}`;
}

async function rewriteProfile(): Promise<boolean> {
  const db = getDb();
  const since = new Date(Date.now() - 56 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const res = await db.execute({
    sql: `SELECT headline, source, topic, reaction FROM digest_reactions
          WHERE entry_date >= ? ORDER BY created_at DESC LIMIT 300`,
    args: [since],
  });

  // Nothing to learn from yet — leave the existing profile alone.
  if (res.rows.length < 5) return false;

  const current = await getProfile();
  const lines = res.rows
    .map((r) => `- ${r.reaction}: "${r.headline}" (${r.source}, ${r.topic || "—"})`)
    .join("\n");

  try {
    const anthropic = new Anthropic();
    const response = await anthropic.messages.create({
      model: "claude-sonnet-5",
      max_tokens: 3000,
      output_config: { effort: "medium" },
      messages: [
        {
          role: "user",
          content: `Rewrite Waverley's taste profile for a daily news digest, based on how she's actually reacted.

Current profile:
${current}

Reactions ("more"/"less" are explicit; "open" means she clicked through, a weak positive):
${lines}

Write a short plain-English profile — three short paragraphs at most — covering what she leans towards, what she skips, and what's growing or fading. Be specific and concrete; name topics and kinds of writing, not sources alone. Don't flatter, don't hedge, don't editorialise about her. Respond with only the profile text.`,
        },
      ],
    });

    if (response.stop_reason === "refusal") return false;
    const block = response.content.find((b) => b.type === "text");
    const text = block && block.type === "text" ? block.text.trim() : "";
    if (!text) return false;

    const history = await readState<{ text: string; updatedAt: string }[]>(
      STATE.profileHistory,
      []
    );
    const previous = await readState<{ text: string; updatedAt: string } | null>(
      STATE.profile,
      null
    );
    if (previous?.text) {
      await writeState(
        STATE.profileHistory,
        [previous, ...history].slice(0, PROFILE_HISTORY_LIMIT)
      );
    }
    await writeState(STATE.profile, { text, updatedAt: new Date().toISOString() });
    return true;
  } catch (error) {
    console.error("Taste profile rewrite failed:", error);
    return false;
  }
}

/**
 * Monthly, deterministic — no AI needed. Suggestions only; the source list is
 * never edited automatically.
 */
async function refreshSuggestions(sources: DigestSource[]): Promise<void> {
  const db = getDb();
  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);
  const res = await db.execute({
    sql: `SELECT source, reaction, COUNT(*) AS n FROM digest_reactions
          WHERE entry_date >= ? GROUP BY source, reaction`,
    args: [since],
  });

  const tally = new Map<string, { more: number; less: number; open: number }>();
  for (const row of res.rows) {
    const name = String(row.source);
    const entry = tally.get(name) || { more: 0, less: 0, open: 0 };
    const reaction = String(row.reaction) as "more" | "less" | "open";
    if (reaction in entry) entry[reaction] += Number(row.n);
    tally.set(name, entry);
  }

  const rarelyLiked: string[] = [];
  const wildcardWinners: string[] = [];

  for (const source of sources) {
    const t = tally.get(source.name);
    if (!t) continue;
    const positives = t.more + t.open;
    if (!source.wildcard && t.less >= 3 && positives === 0) rarelyLiked.push(source.name);
    if (source.wildcard && t.more >= 3) wildcardWinners.push(source.name);
  }

  await writeState(STATE.suggestions, {
    generatedAt: new Date().toISOString(),
    rarelyLiked,
    wildcardWinners,
  });
}

export function isUnhealthy(h: SourceHealth | undefined): boolean {
  return !!h && h.failStreak >= UNHEALTHY_STREAK;
}
