"use client";

import { useCallback, useEffect, useState } from "react";

interface SourceHealth {
  lastSuccess: string | null;
  lastCount: number;
  failStreak: number;
  lastError?: string;
}

interface Source {
  id: string;
  name: string;
  category: string;
  url: string;
  fallbackUrl?: string;
  wildcard?: boolean;
}

interface Suggestions {
  generatedAt?: string;
  rarelyLiked?: string[];
  wildcardWinners?: string[];
}

function healthLabel(h: SourceHealth | undefined): string {
  if (!h) return "not fetched yet";
  if (h.failStreak >= 3) {
    return `failing ${h.failStreak} days — ${h.lastError || "no items"}`;
  }
  if (!h.lastSuccess) return "no successful fetch yet";
  const days = Math.round((Date.now() - Date.parse(h.lastSuccess)) / 86400000);
  return `${h.lastCount} items, ${days === 0 ? "today" : `${days}d ago`}`;
}

export default function DigestSettings({ onClose }: { onClose: () => void }) {
  const [profile, setProfile] = useState("");
  const [profileSaved, setProfileSaved] = useState(false);
  const [history, setHistory] = useState<{ text: string; updatedAt: string }[]>([]);
  const [showHistory, setShowHistory] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestions | null>(null);

  const [sourcesText, setSourcesText] = useState("");
  const [sources, setSources] = useState<Source[]>([]);
  const [health, setHealth] = useState<Record<string, SourceHealth>>({});
  const [sourcesError, setSourcesError] = useState<string | null>(null);
  const [sourcesSaved, setSourcesSaved] = useState(false);

  useEffect(() => {
    fetch("/api/digest/profile")
      .then((r) => r.json())
      .then((d) => {
        setProfile(d.text || "");
        setHistory(d.history || []);
        setSuggestions(d.suggestions || null);
      })
      .catch(() => {});

    fetch("/api/digest/sources")
      .then((r) => r.json())
      .then((d) => {
        setSources(d.sources || []);
        setHealth(d.health || {});
        setSourcesText(JSON.stringify(d.sources || [], null, 2));
      })
      .catch(() => {});
  }, []);

  const saveProfile = useCallback(async () => {
    setProfileSaved(false);
    const res = await fetch("/api/digest/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ text: profile }),
    });
    if (res.ok) setProfileSaved(true);
  }, [profile]);

  const saveSources = useCallback(async () => {
    setSourcesError(null);
    setSourcesSaved(false);
    let parsed: unknown;
    try {
      parsed = JSON.parse(sourcesText);
    } catch {
      setSourcesError("That isn't valid JSON — check for a trailing comma.");
      return;
    }
    const res = await fetch("/api/digest/sources", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sources: parsed }),
    });
    const json = await res.json();
    if (json.error) {
      setSourcesError(json.error);
    } else {
      setSourcesSaved(true);
      setSources(parsed as Source[]);
    }
  }, [sourcesText]);

  const unhealthy = sources.filter((s) => (health[s.id]?.failStreak || 0) >= 3);

  return (
    <div className="mt-3 rounded-2xl border border-forest/10 bg-white/90 p-4 flex flex-col gap-5">
      <div className="flex items-center">
        <h3 className="text-[11px] font-semibold uppercase tracking-[0.12em] text-forest">
          Taste &amp; sources
        </h3>
        <button
          type="button"
          onClick={onClose}
          className="ml-auto text-[10px] uppercase tracking-wider text-black/30 hover:text-black/60"
        >
          Close
        </button>
      </div>

      {/* Feed health — flagged, never silently dropped */}
      {unhealthy.length > 0 && (
        <div className="rounded-lg border border-blush/30 bg-blush/5 p-2.5">
          <p className="text-[10px] font-semibold text-blush uppercase tracking-wider mb-1">
            Needs attention
          </p>
          {unhealthy.map((s) => (
            <p key={s.id} className="text-[11px] text-black/60">
              {s.name} — {healthLabel(health[s.id])}
            </p>
          ))}
        </div>
      )}

      {/* Monthly suggestions — never applied automatically */}
      {suggestions &&
        ((suggestions.rarelyLiked?.length || 0) > 0 ||
          (suggestions.wildcardWinners?.length || 0) > 0) && (
          <div className="rounded-lg border border-forest/10 bg-forest/[0.03] p-2.5">
            <p className="text-[10px] font-semibold text-forest/60 uppercase tracking-wider mb-1">
              Suggestions
            </p>
            {(suggestions.rarelyLiked?.length || 0) > 0 && (
              <p className="text-[11px] text-black/60">
                Rarely liked: {suggestions.rarelyLiked?.join(", ")} — consider removing.
              </p>
            )}
            {(suggestions.wildcardWinners?.length || 0) > 0 && (
              <p className="text-[11px] text-black/60">
                Wildcards you keep liking: {suggestions.wildcardWinners?.join(", ")} — consider
                promoting to a regular source.
              </p>
            )}
          </div>
        )}

      {/* Taste profile */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-black/40">
            Taste profile
          </label>
          {history.length > 0 && (
            <button
              type="button"
              onClick={() => setShowHistory((v) => !v)}
              className="text-[10px] text-black/30 hover:text-forest"
            >
              {showHistory ? "hide" : `${history.length} previous`}
            </button>
          )}
          <button
            type="button"
            onClick={saveProfile}
            className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-cerulean hover:text-cerulean/70"
          >
            {profileSaved ? "Saved" : "Save"}
          </button>
        </div>
        <textarea
          value={profile}
          onChange={(e) => {
            setProfile(e.target.value);
            setProfileSaved(false);
          }}
          rows={7}
          className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-[11px] leading-relaxed text-black/75 outline-none focus:border-cerulean/50 resize-y"
        />
        <p className="text-[10px] text-black/30">
          Rewritten from your reactions each Monday. Edit freely — your version is used as-is until
          the next rewrite.
        </p>

        {showHistory && (
          <div className="flex flex-col gap-2 mt-1 max-h-48 overflow-y-auto component-scroll">
            {history.map((v) => (
              <div key={v.updatedAt} className="rounded-lg bg-black/[0.03] p-2">
                <p className="text-[9px] uppercase tracking-wider text-black/30 mb-1">
                  {new Date(v.updatedAt).toLocaleDateString("en-GB")}
                </p>
                <p className="text-[10px] text-black/50 whitespace-pre-wrap">{v.text}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Source list */}
      <div className="flex flex-col gap-1.5">
        <div className="flex items-center gap-2">
          <label className="text-[10px] uppercase tracking-wider font-semibold text-black/40">
            Sources ({sources.length})
          </label>
          <button
            type="button"
            onClick={saveSources}
            className="ml-auto text-[10px] uppercase tracking-wider font-semibold text-cerulean hover:text-cerulean/70"
          >
            {sourcesSaved ? "Saved" : "Save"}
          </button>
        </div>
        <textarea
          value={sourcesText}
          onChange={(e) => {
            setSourcesText(e.target.value);
            setSourcesSaved(false);
          }}
          rows={10}
          spellCheck={false}
          className="w-full rounded-xl border border-forest/15 bg-white px-3 py-2 text-[10px] font-mono leading-relaxed text-black/70 outline-none focus:border-cerulean/50 resize-y"
        />
        {sourcesError && <p className="text-[10px] text-red-400">{sourcesError}</p>}

        <div className="flex flex-col gap-0.5 mt-1 max-h-40 overflow-y-auto component-scroll">
          {sources.map((s) => (
            <div key={s.id} className="flex items-baseline gap-2 text-[10px]">
              <span className="text-black/55 w-40 shrink-0 truncate">{s.name}</span>
              <span
                className={
                  (health[s.id]?.failStreak || 0) >= 3 ? "text-blush" : "text-black/30"
                }
              >
                {healthLabel(health[s.id])}
              </span>
              {s.wildcard && (
                <span className="ml-auto text-[9px] uppercase tracking-wider text-forest/40">
                  wildcard
                </span>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
