"use client";

import { useState, useEffect, useCallback } from "react";
import ComponentCard from "./ComponentCard";

type Category = {
  label: string;
  spent: number;
  target: number;
};

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
            const isOver = cat.spent > cat.target;
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
                      backgroundColor: isOver ? "#e05252" : "var(--cerulean)",
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
