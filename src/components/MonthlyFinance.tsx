"use client";

import { useState, useEffect, useCallback } from "react";
import ComponentCard from "./ComponentCard";

type Category = {
  label: string;
  spent: number;
  target: number;
};

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function barColor(ratio: number): string {
  // Green (#4caf50) → Yellow (#f5c342) → Red (#e05252)
  // Smooth blend: green < 0.7, transition 0.7–0.9, red > 0.9
  const green = [76, 175, 80];
  const yellow = [245, 195, 66];
  const red = [224, 82, 82];

  let r: number, g: number, b: number;

  if (ratio <= 0.7) {
    [r, g, b] = green;
  } else if (ratio <= 0.9) {
    const t = (ratio - 0.7) / 0.2;
    r = lerp(green[0], yellow[0], t);
    g = lerp(green[1], yellow[1], t);
    b = lerp(green[2], yellow[2], t);
  } else {
    const t = Math.min((ratio - 0.9) / 0.2, 1);
    r = lerp(yellow[0], red[0], t);
    g = lerp(yellow[1], red[1], t);
    b = lerp(yellow[2], red[2], t);
  }

  return `rgb(${Math.round(r)},${Math.round(g)},${Math.round(b)})`;
}

const placeholderData: Category[] = [
  { label: "Groceries", spent: 0, target: 300 },
  { label: "Going Out", spent: 0, target: 300 },
  { label: "Self Care", spent: 0, target: 200 },
  { label: "Travel", spent: 0, target: 150 },
  { label: "Treat Spend", spent: 0, target: 250 },
];

export default function MonthlyFinance() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);

  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance?_t=${Date.now()}`);
      const data = await res.json();
      if (data.categories) {
        setCategories(data.categories);
      }
    } catch (err) {
      console.error("Failed to fetch finance data:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchFinance();
  }, [fetchFinance]);

  return (
    <ComponentCard title="Monthly Finance" className="h-full" onRefresh={fetchFinance}>
      <div className="flex justify-end -mt-2 mb-2">
        <button
          onClick={() => setVisible((v) => !v)}
          className="text-black/30 hover:text-black/50 transition-colors"
          aria-label={visible ? "Hide finance data" : "Show finance data"}
        >
          {visible ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          )}
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-xs text-black/40 py-2">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-black/40 py-2">No data for this month.</p>
        ) : (
          (visible ? categories : placeholderData).map((cat) => {
            const pct = cat.target > 0 ? Math.min((cat.spent / cat.target) * 100, 100) : 0;
            const ratio = cat.target > 0 ? cat.spent / cat.target : 0;
            return (
              <div key={cat.label}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-black/70">{cat.label}</span>
                  <span className="text-xs tabular-nums text-black/50">
                    {visible ? `£${cat.spent}` : "£••••"}{" "}
                    <span className="text-black/25">/ {visible ? `£${cat.target}` : "£••••"}</span>
                  </span>
                </div>
                <div className="h-2 bg-forest/8 rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full transition-all"
                    style={{
                      width: `${pct}%`,
                      backgroundColor: barColor(ratio),
                    }}
                  />
                </div>
              </div>
            );
          })
        )}
      </div>
    </ComponentCard>
  );
}
