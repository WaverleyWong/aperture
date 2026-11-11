/**
 * Default feed list for the daily external digest.
 *
 * These are only the *defaults*. The live list is stored in `live_state` under
 * `digest_sources` and is editable from the dashboard, so adding or removing a
 * feed doesn't need a code change. This file is what seeds that row the first
 * time the job runs, and what "reset to defaults" would restore.
 *
 * Every URL here was fetched and verified before being added.
 */

export interface DigestSource {
  id: string;
  name: string;
  category: string;
  url: string;
  /** Used automatically if `url` errors or returns zero items. */
  fallbackUrl?: string;
  /** Wildcard sources are only ever used for the two wildcard cards. */
  wildcard?: boolean;
}

export const DEFAULT_SOURCES: DigestSource[] = [
  // ── Food (weighted heaviest in the seed taste profile) ──
  {
    id: "hot-dinners",
    name: "Hot Dinners",
    category: "food",
    // Joomla internal feed. The obvious paths (/feed, /rss, /feed/rss/) are all
    // dead or return an empty channel; this one is linked from their own RSS
    // page. If the Itemid ever changes, the fallback picks up the slack.
    url: "https://www.hot-dinners.com/index.php?option=com_joomrss&task=feed&id=2:hot-dinners-rss-feed&format=feed&Itemid=2709",
    fallbackUrl: "https://www.hot-dinners.com/gastro-blog?format=feed&type=rss",
  },
  { id: "vittles", name: "Vittles", category: "food", url: "https://vittles.substack.com/feed" },

  // ── Games / indie dev ──
  { id: "polygon", name: "Polygon", category: "games", url: "https://www.polygon.com/rss/index.xml" },
  { id: "aftermath", name: "Aftermath", category: "games", url: "https://aftermath.site/feed" },
  {
    id: "how-to-market-a-game",
    name: "How To Market A Game",
    category: "indie-dev",
    url: "https://howtomarketagame.com/feed/",
  },
  {
    id: "game-developer",
    name: "Game Developer",
    category: "indie-dev",
    url: "https://www.gamedeveloper.com/rss.xml",
  },
  {
    id: "rock-paper-shotgun",
    name: "Rock Paper Shotgun",
    category: "games",
    url: "https://www.rockpapershotgun.com/feed",
  },

  // ── Music ──
  { id: "the-quietus", name: "The Quietus", category: "music", url: "https://thequietus.com/feed/" },
  {
    id: "line-of-best-fit",
    name: "The Line of Best Fit",
    category: "music",
    url: "https://www.thelineofbestfit.com/feed",
  },
  // Substituted for Resident Advisor, which no longer publishes any RSS feed.
  { id: "fact-magazine", name: "FACT Magazine", category: "music", url: "https://www.factmag.com/feed/" },

  // ── London theatre ──
  {
    id: "whatsonstage",
    name: "WhatsOnStage",
    category: "theatre",
    // The site-root /feed/ is a valid but empty channel — /news/ is the real one.
    url: "https://www.whatsonstage.com/news/feed/",
  },
  // Substituted for londontheatre.co.uk, which publishes no feed.
  {
    id: "official-london-theatre",
    name: "Official London Theatre",
    category: "theatre",
    url: "https://officiallondontheatre.com/feed/",
  },

  // ── Product / growth ──
  // This single feed carries both the newsletter and the podcast episodes.
  {
    id: "lennys-newsletter",
    name: "Lenny's Newsletter & Podcast",
    category: "product",
    url: "https://www.lennysnewsletter.com/feed",
  },

  // ── AI ──
  {
    id: "simon-willison",
    name: "Simon Willison",
    category: "ai",
    url: "https://simonwillison.net/atom/everything/",
  },
  {
    id: "one-useful-thing",
    name: "One Useful Thing",
    category: "ai",
    url: "https://www.oneusefulthing.org/feed",
  },
  { id: "latent-space", name: "Latent Space", category: "ai", url: "https://www.latent.space/feed" },

  // ── Culture ──
  { id: "vice", name: "VICE", category: "culture", url: "https://www.vice.com/en/rss" },

  // ── Wildcard pool — never used for the 8 matched cards ──
  {
    id: "guardian-culture",
    name: "Guardian Culture",
    category: "culture",
    url: "https://www.theguardian.com/culture/rss",
    wildcard: true,
  },
  {
    id: "hacker-news",
    name: "Hacker News",
    category: "tech",
    url: "https://news.ycombinator.com/rss",
    wildcard: true,
  },
];

/** Plain-English starting point, rewritten from real reactions each Monday. */
export const SEED_PROFILE = `Leans heaviest towards food — London restaurant openings, who's cooking where, and writing that treats food as culture rather than consumer advice.

Also strongly drawn to: independent game development (the craft and business of shipping a game, not console news), music discovery across electronic and guitar music, London theatre worth booking, product and growth thinking, and practical AI developments — what people are actually building and what it changes.

Prefers specific over general, people over products, and a clear point of view over neutral summary. Not interested in press-release churn, listicles, or hype without substance.`;
