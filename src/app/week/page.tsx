"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import SkyBanner from "@/components/SkyBanner";
import {
  addDaysISO,
  buildMarkdown,
  formatDayHeading,
  formatWeekRange,
  getTodayLondonISO,
  getWeekStartISO,
  groupByDay,
  type WeekEntry,
} from "@/lib/week";

function notionUrl(pageId: string): string {
  return `https://www.notion.so/${pageId.replace(/-/g, "")}`;
}

export default function WeekPage() {
  const [weekStart, setWeekStart] = useState<string | null>(null);
  const [entries, setEntries] = useState<WeekEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Omitting `week` lets the server pick the default: the week holding the most
  // recent entry, falling back to the current week.
  const load = useCallback((week?: string) => {
    fetch(week ? `/api/week-log?week=${week}` : "/api/week-log")
      .then((r) => r.json())
      .then((data) => {
        if (data.weekStart) setWeekStart(data.weekStart);
        setEntries(data.entries ?? []);
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Show the previous week's entries until the new ones land
  const goToWeek = useCallback((week: string) => {
    setLoading(true);
    load(week);
  }, [load]);

  useEffect(() => { load(); }, [load]);

  // Listen for global refresh
  useEffect(() => {
    const handler = () => { setLoading(true); load(weekStart ?? undefined); };
    window.addEventListener("aperture-refresh-all", handler);
    return () => window.removeEventListener("aperture-refresh-all", handler);
  }, [load, weekStart]);

  const deleteEntry = async (id: number) => {
    setEntries((prev) => prev.filter((e) => e.id !== id));
    try {
      await fetch(`/api/week-log?id=${id}`, { method: "DELETE" });
    } catch (err) {
      console.error("Failed to delete entry:", err);
      load(weekStart ?? undefined);
    }
  };

  const days = weekStart ? groupByDay(weekStart, entries) : [];

  const copyMarkdown = async () => {
    if (!weekStart) return;
    try {
      await navigator.clipboard.writeText(buildMarkdown(weekStart, days));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy:", err);
    }
  };

  const canGoNext = weekStart !== null && weekStart < getWeekStartISO(getTodayLondonISO());

  return (
    <SkyBanner>
      <div className="anim-fade-in max-w-2xl rounded-3xl border border-forest/10 bg-white/90 backdrop-blur-md p-5 md:p-6 shadow-[0_1px_4px_rgba(0,0,0,0.06),0_6px_20px_rgba(0,0,0,0.04)]">
        {/* Back to the dashboard */}
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 -ml-1 mb-3 py-1.5 px-2 rounded-lg text-forest/40 hover:text-cerulean hover:bg-forest/5 transition-colors"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
            <polyline points="15 18 9 12 15 6" />
          </svg>
          <span className="text-[11px] font-medium uppercase tracking-wider">Dashboard</span>
        </Link>

        {/* Header — literal date range, with week navigation */}
        <div className="flex items-center justify-between gap-3 mb-5">
          <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">
            {weekStart ? formatWeekRange(weekStart) : "Week Log"}
          </h2>

          <div className="flex items-center gap-1">
            <button
              onClick={() => weekStart && goToWeek(addDaysISO(weekStart, -7))}
              disabled={!weekStart}
              className="p-1.5 rounded-lg text-forest/40 hover:text-forest hover:bg-forest/5 disabled:text-black/15 disabled:hover:bg-transparent transition-colors"
              aria-label="Previous week"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="15 18 9 12 15 6" />
              </svg>
            </button>
            <button
              onClick={() => weekStart && goToWeek(addDaysISO(weekStart, 7))}
              disabled={!canGoNext}
              className="p-1.5 rounded-lg text-forest/40 hover:text-forest hover:bg-forest/5 disabled:text-black/15 disabled:hover:bg-transparent transition-colors"
              aria-label="Next week"
            >
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="9 18 15 12 9 6" />
              </svg>
            </button>
          </div>
        </div>

        <div className={`transition-opacity duration-200 ${loading ? "opacity-30" : "opacity-100"}`}>
          {days.length === 0 ? (
            <p className="text-xs text-black/40 py-6">Nothing logged this week.</p>
          ) : (
            <div className="flex flex-col gap-5">
              {days.map((day) => (
                <div key={day.date}>
                  <h3 className="text-[11px] font-medium uppercase tracking-wider text-black/40 mb-2">
                    {formatDayHeading(day.date)}
                  </h3>
                  <div className="flex flex-col gap-0.5">
                    {day.entries.map((entry) => (
                      <div
                        key={entry.id}
                        className="group flex items-center gap-2 py-2 md:py-1.5 px-2 rounded-lg hover:bg-forest/5 transition-colors"
                      >
                        <span className="flex-1 text-sm leading-snug text-black">
                          {entry.title}
                        </span>

                        {entry.notionPageId && (
                          <a
                            href={notionUrl(entry.notionPageId)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-forest/30 hover:text-cerulean transition-colors p-1"
                            aria-label="Open in Notion"
                            title="Open in Notion"
                          >
                            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6" />
                              <polyline points="15 3 21 3 21 9" />
                              <line x1="10" y1="14" x2="21" y2="3" />
                            </svg>
                          </a>
                        )}

                        <button
                          onClick={() => deleteEntry(entry.id)}
                          className="opacity-0 group-hover:opacity-100 focus:opacity-100 text-black/30 hover:text-red-500 transition-all text-xs p-1"
                          aria-label="Delete entry"
                        >
                          ✕
                        </button>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Copy as markdown */}
        <button
          onClick={copyMarkdown}
          disabled={days.length === 0}
          className="mt-6 w-full text-sm font-medium bg-cerulean text-white py-2.5 px-4 rounded-xl hover:bg-cerulean/90 disabled:bg-black/10 disabled:text-black/30 transition-colors"
        >
          {copied ? "Copied" : "Copy as markdown"}
        </button>
      </div>
    </SkyBanner>
  );
}
