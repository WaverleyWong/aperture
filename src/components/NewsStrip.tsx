"use client";

import { useCallback, useEffect, useState } from "react";
import DigestSettings from "./DigestSettings";

type Card = {
  url: string;
  headline: string;
  source: string;
  sourceId: string;
  image: string | null;
  reason: string;
  topic: string;
  wildcard: boolean;
};

type Reaction = "more" | "less" | "open";

function relativeTime(iso: string | null): string {
  if (!iso) return "not yet generated";
  const mins = Math.round((Date.now() - Date.parse(iso)) / 60000);
  if (!Number.isFinite(mins)) return "unknown";
  if (mins < 2) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

/** Deterministic tint so a card with no image still looks placed, not broken. */
function fallbackTint(source: string): string {
  const tints = [
    "from-forest/15 to-forest/5",
    "from-cerulean/15 to-cerulean/5",
    "from-blush/15 to-blush/5",
  ];
  let hash = 0;
  for (let i = 0; i < source.length; i++) hash = (hash + source.charCodeAt(i)) % tints.length;
  return tints[hash];
}

function NewsCard({
  card,
  reacted,
  onReact,
}: {
  card: Card;
  reacted: Reaction | null;
  onReact: (card: Card, reaction: Reaction) => void;
}) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = card.image && !imageFailed;

  return (
    <div className="shrink-0 w-[208px] snap-start flex flex-col rounded-2xl border border-forest/10 bg-white/90 overflow-hidden shadow-[0_1px_3px_rgba(0,0,0,0.05)]">
      <a
        href={card.url}
        target="_blank"
        rel="noopener noreferrer"
        onClick={() => onReact(card, "open")}
        className="group flex flex-col"
      >
        <div className="relative h-[88px] w-full overflow-hidden">
          {showImage ? (
            // Remote feed images from many hosts — next/image would need every
            // domain whitelisted, so a plain img is the pragmatic choice here.
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={card.image as string}
              alt=""
              loading="lazy"
              onError={() => setImageFailed(true)}
              className="h-full w-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
            />
          ) : (
            <div className={`h-full w-full bg-gradient-to-br ${fallbackTint(card.source)}`} />
          )}
          {card.wildcard && (
            <span className="absolute top-1.5 left-1.5 text-[8px] uppercase tracking-[0.1em] font-semibold text-white bg-black/45 backdrop-blur-sm rounded px-1.5 py-0.5">
              Wildcard
            </span>
          )}
        </div>

        <div className="flex flex-col gap-1 p-2.5">
          <span className="text-[9px] uppercase tracking-[0.1em] font-semibold text-forest/50">
            {card.source}
          </span>
          <h3 className="text-[12px] font-medium text-black/85 leading-snug line-clamp-3">
            {card.headline}
          </h3>
          {card.reason && (
            <p className="text-[10px] text-black/45 leading-snug line-clamp-2">{card.reason}</p>
          )}
        </div>
      </a>

      <div className="flex items-center gap-1 px-2.5 pb-2.5 mt-auto">
        <button
          type="button"
          onClick={() => onReact(card, "more")}
          aria-label="More like this"
          className={`text-[9px] uppercase tracking-wider font-semibold rounded-md px-1.5 py-0.5 border transition-colors ${
            reacted === "more"
              ? "border-cerulean/40 bg-cerulean/10 text-cerulean"
              : "border-forest/15 text-black/35 hover:text-cerulean hover:border-cerulean/30"
          }`}
        >
          More
        </button>
        <button
          type="button"
          onClick={() => onReact(card, "less")}
          aria-label="Less like this"
          className={`text-[9px] uppercase tracking-wider font-semibold rounded-md px-1.5 py-0.5 border transition-colors ${
            reacted === "less"
              ? "border-blush/40 bg-blush/10 text-blush"
              : "border-forest/15 text-black/35 hover:text-blush hover:border-blush/30"
          }`}
        >
          Less
        </button>
      </div>
    </div>
  );
}

export default function NewsStrip() {
  const [cards, setCards] = useState<Card[]>([]);
  const [generatedAt, setGeneratedAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reactions, setReactions] = useState<Record<string, Reaction>>({});
  const [settingsOpen, setSettingsOpen] = useState(false);

  // Reads a stored row — never triggers curation.
  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/digest?_t=${Date.now()}`);
      const json = await res.json();
      setCards(json.cards || []);
      setGeneratedAt(json.generatedAt || null);
    } catch {
      setError("Couldn't load the digest");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const onReact = useCallback(async (card: Card, reaction: Reaction) => {
    if (reaction !== "open") {
      setReactions((prev) => ({ ...prev, [card.url]: reaction }));
    }
    try {
      await fetch("/api/digest/react", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: card.url,
          headline: card.headline,
          source: card.source,
          topic: card.topic,
          reaction,
        }),
      });
    } catch {
      /* a lost reaction isn't worth interrupting her for */
    }
  }, []);

  // One Claude call per press. Cron only runs in production, so this is how
  // the digest gets tested on a preview.
  const refresh = useCallback(async () => {
    if (refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const res = await fetch("/api/digest/refresh", { method: "POST" });
      const json = await res.json();
      if (json.error) {
        setError(json.error);
      } else {
        setCards(json.cards || []);
        setGeneratedAt(json.generatedAt || null);
      }
    } catch {
      setError("Refresh failed");
    } finally {
      setRefreshing(false);
    }
  }, [refreshing]);

  if (loading) return null;

  return (
    <section className="anim-fade-in mb-5">
      <div className="flex items-baseline gap-2 mb-2 px-0.5">
        <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">
          Digest
        </h2>
        <span className="text-[10px] text-black/30">updated {relativeTime(generatedAt)}</span>
        <div className="ml-auto flex items-center gap-2">
          <button
            type="button"
            onClick={() => setSettingsOpen((v) => !v)}
            className="text-[10px] uppercase tracking-wider font-semibold text-black/30 hover:text-forest transition-colors"
          >
            Taste
          </button>
          <button
            type="button"
            onClick={refresh}
            disabled={refreshing}
            className="text-[10px] uppercase tracking-wider font-semibold text-black/30 hover:text-cerulean disabled:text-black/20 transition-colors"
          >
            {refreshing ? "Refreshing…" : "Refresh"}
          </button>
        </div>
      </div>

      {error && <p className="text-[11px] text-red-400 mb-2 px-0.5">{error}</p>}

      {cards.length === 0 ? (
        <p className="text-[11px] text-black/35 italic px-0.5">
          No cards yet — the daily job runs at 05:00, or press Refresh.
        </p>
      ) : (
        <div className="flex gap-3 overflow-x-auto scrollbar-none snap-x snap-mandatory pb-1">
          {cards.map((card) => (
            <NewsCard
              key={card.url}
              card={card}
              reacted={reactions[card.url] || null}
              onReact={onReact}
            />
          ))}
        </div>
      )}

      {settingsOpen && <DigestSettings onClose={() => setSettingsOpen(false)} />}
    </section>
  );
}
