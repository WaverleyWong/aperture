/**
 * Minimal RSS / Atom reader.
 *
 * Hand-rolled rather than pulling in an XML dependency: every feed in the
 * source list was fetched and inspected first, and they're all well-formed
 * RSS 2.0 or Atom. Parsing is deliberately forgiving — a field we can't read
 * yields null rather than throwing, because one odd item shouldn't lose a
 * whole feed.
 */

export interface FeedItem {
  title: string;
  link: string;
  /** Epoch ms, or null when the feed gives no usable date. */
  published: number | null;
  summary: string;
  image: string | null;
}

export interface FeedResult {
  items: FeedItem[];
  ok: boolean;
  error?: string;
}

const FETCH_TIMEOUT_MS = 15000;

function decodeEntities(raw: string): string {
  return raw
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#0?39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&nbsp;/g, " ")
    .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n)))
    .replace(/&amp;/g, "&");
}

function stripTags(raw: string): string {
  return decodeEntities(raw.replace(/<[^>]*>/g, " "))
    .replace(/\s+/g, " ")
    .trim();
}

/** Pulls the text of the first matching tag, unwrapping CDATA. */
function tagText(block: string, ...names: string[]): string {
  for (const name of names) {
    const match = block.match(
      new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, "i")
    );
    if (match) {
      const inner = match[1].replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, "$1");
      const text = decodeEntities(inner).trim();
      if (text) return text;
    }
  }
  return "";
}

function parseLink(block: string): string {
  // Atom: prefer rel="alternate", else the first href.
  const alternate = block.match(
    /<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i
  );
  if (alternate) return decodeEntities(alternate[1]);

  const href = block.match(/<link[^>]*href=["']([^"']+)["']/i);
  if (href) return decodeEntities(href[1]);

  // RSS: <link>url</link>
  const rss = tagText(block, "link");
  if (rss) return rss;

  return tagText(block, "guid");
}

function parseImage(block: string): string | null {
  const media = block.match(
    /<media:(?:content|thumbnail)[^>]*url=["']([^"']+)["']/i
  );
  if (media) return decodeEntities(media[1]);

  const enclosure = block.match(
    /<enclosure[^>]*url=["']([^"']+)["'][^>]*type=["']image\//i
  );
  if (enclosure) return decodeEntities(enclosure[1]);

  // Some feeds only put the image inside the escaped HTML body.
  const body = `${tagText(block, "content:encoded", "content")} ${tagText(block, "description", "summary")}`;
  const img = body.match(/<img[^>]*src=["']([^"']+)["']/i);
  if (img) return decodeEntities(img[1]);

  return null;
}

function parseDate(block: string): number | null {
  const raw = tagText(block, "pubDate", "published", "updated", "dc:date");
  if (!raw) return null;
  const ms = Date.parse(raw);
  return Number.isNaN(ms) ? null : ms;
}

export function parseFeed(xml: string): FeedItem[] {
  const blocks =
    xml.match(/<item(?:\s[^>]*)?>[\s\S]*?<\/item>/gi) ||
    xml.match(/<entry(?:\s[^>]*)?>[\s\S]*?<\/entry>/gi) ||
    [];

  const items: FeedItem[] = [];
  for (const block of blocks) {
    const title = stripTags(tagText(block, "title"));
    const link = parseLink(block);
    if (!title || !link || !/^https?:\/\//i.test(link)) continue;

    items.push({
      title,
      link,
      published: parseDate(block),
      summary: stripTags(
        tagText(block, "description", "summary", "content:encoded", "content")
      ).slice(0, 400),
      image: parseImage(block),
    });
  }
  return items;
}

export async function fetchFeed(url: string): Promise<FeedResult> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);

    const res = await fetch(url, {
      signal: controller.signal,
      cache: "no-store",
      headers: {
        // Some feeds 403 a bare fetch.
        "User-Agent": "Mozilla/5.0 (compatible; ApertureDigest/1.0)",
        Accept: "application/rss+xml, application/atom+xml, application/xml, text/xml, */*",
      },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return { items: [], ok: false, error: `HTTP ${res.status}` };

    const items = parseFeed(await res.text());
    return { items, ok: true };
  } catch (error) {
    return {
      items: [],
      ok: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Last-resort image: the article's own og:image. Only used for the handful of
 * feeds that ship no image at all (Polygon, WhatsOnStage, Hacker News), and
 * only for cards that actually made the cut.
 */
export async function fetchOgImage(articleUrl: string): Promise<string | null> {
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 8000);

    const res = await fetch(articleUrl, {
      signal: controller.signal,
      cache: "no-store",
      headers: { "User-Agent": "Mozilla/5.0 (compatible; ApertureDigest/1.0)" },
    }).finally(() => clearTimeout(timer));

    if (!res.ok) return null;

    // Only the head is needed; avoid reading entire articles into memory.
    const html = (await res.text()).slice(0, 60000);
    const match =
      html.match(
        /<meta[^>]*property=["']og:image["'][^>]*content=["']([^"']+)["']/i
      ) ||
      html.match(
        /<meta[^>]*name=["']twitter:image["'][^>]*content=["']([^"']+)["']/i
      );
    return match ? decodeEntities(match[1]) : null;
  } catch {
    return null;
  }
}
