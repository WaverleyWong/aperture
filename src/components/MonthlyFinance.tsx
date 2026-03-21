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

export default function MonthlyFinance() {
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);

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
      <div className="flex flex-col gap-4">
        {loading ? (
          <p className="text-xs text-black/40 py-2">Loading…</p>
        ) : categories.length === 0 ? (
          <p className="text-xs text-black/40 py-2">No data for this month.</p>
        ) : (
          categories.map((cat) => {
            const pct = cat.target > 0 ? Math.min((cat.spent / cat.target) * 100, 100) : 0;
            const ratio = cat.target > 0 ? cat.spent / cat.target : 0;
            return (
              <div key={cat.label}>
                <div className="flex justify-between items-baseline mb-1.5">
                  <span className="text-xs text-black/70">{cat.label}</span>
                  <span className="text-xs tabular-nums text-black/50">
                    £{cat.spent}{" "}
                    <span className="text-black/25">/ £{cat.target}</span>
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
