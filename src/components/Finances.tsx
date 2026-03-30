"use client";

import { useState, useEffect, useCallback } from "react";
import ComponentCard from "./ComponentCard";

// ── Types ──

type WeeklyCategory = {
  thisWeek: number;
  weeklyAvg: number;
  weeklyBudget: number;
  monthTotal: number;
  monthTarget: number;
};

type WeeklyData = {
  groceries: WeeklyCategory;
  goingOut: WeeklyCategory;
  monthProgress: number;
  currentWeek: number;
};

type MonthlyCategory = {
  label: string;
  spent: number;
  target: number;
};

type Subscription = {
  name: string;
  expected: number;
  charged: number | null;
};

// ── Colour helpers ──

function lerp(a: number, b: number, t: number) {
  return a + (b - a) * t;
}

function barColor(ratio: number): string {
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

// ── Sub-panels ──

function WeeklyPanel({
  data,
  visible,
}: {
  data: WeeklyData;
  visible: boolean;
}) {
  const categories = [
    { label: "Groceries", ...data.groceries },
    { label: "Going Out", ...data.goingOut },
  ];

  return (
    <div className="flex flex-col gap-5">
      {categories.map((cat) => {
        const paceTarget = cat.monthTarget * data.monthProgress;
        const actualRatio = cat.monthTarget > 0 ? cat.monthTotal / cat.monthTarget : 0;
        const paceRatio = data.monthProgress;

        return (
          <div key={cat.label}>
            <div className="flex justify-between items-baseline mb-1">
              <span className="text-xs text-black/70">{cat.label}</span>
              <span className="text-xs tabular-nums text-black/50">
                {visible ? `£${cat.thisWeek.toFixed(0)}` : "£••••"}
                <span className="text-black/25"> this week</span>
              </span>
            </div>

            {/* Stats row */}
            <div className="flex gap-4 mb-2">
              <span className="text-[10px] tabular-nums text-black/40">
                Avg {visible ? `£${cat.weeklyAvg.toFixed(0)}` : "£••••"}/wk
              </span>
              <span className="text-[10px] tabular-nums text-black/40">
                Budget {visible ? `£${cat.weeklyBudget.toFixed(0)}` : "£••••"}/wk
              </span>
            </div>

            {/* Pace bar */}
            <div className="relative h-2 bg-forest/8 rounded-full overflow-hidden">
              {/* Actual spend */}
              <div
                className="absolute inset-y-0 left-0 rounded-full transition-all"
                style={{
                  width: `${Math.min(actualRatio * 100, 100)}%`,
                  backgroundColor: barColor(actualRatio),
                }}
              />
              {/* Pace line — where you should be */}
              <div
                className="absolute top-0 h-full w-[2px] bg-black/30 rounded-full"
                style={{ left: `${Math.min(paceRatio * 100, 100)}%` }}
                title={`Pace: £${paceTarget.toFixed(0)} of £${cat.monthTarget}`}
              />
            </div>

            {/* Monthly context */}
            <div className="flex justify-between mt-1">
              <span className="text-[10px] tabular-nums text-black/25">
                {visible ? `£${cat.monthTotal.toFixed(0)}` : "£••••"} spent
              </span>
              <span className="text-[10px] tabular-nums text-black/25">
                {visible ? `£${cat.monthTarget.toFixed(0)}` : "£••••"} target
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function MonthlyPanel({
  categories,
  visible,
}: {
  categories: MonthlyCategory[];
  visible: boolean;
}) {
  return (
    <div className="flex flex-col gap-4">
      {categories.map((cat) => {
        const pct = cat.target > 0 ? Math.min((cat.spent / cat.target) * 100, 100) : 0;
        const ratio = cat.target > 0 ? cat.spent / cat.target : 0;
        return (
          <div key={cat.label}>
            <div className="flex justify-between items-baseline mb-1.5">
              <span className="text-xs text-black/70">{cat.label}</span>
              <span className="text-xs tabular-nums text-black/50">
                {visible ? `£${cat.spent.toFixed(0)}` : "£••••"}{" "}
                <span className="text-black/25">
                  / {visible ? `£${cat.target}` : "£••••"}
                </span>
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
      })}
    </div>
  );
}

function SubsPanel({
  subscriptions,
  visible,
}: {
  subscriptions: Subscription[];
  visible: boolean;
}) {
  return (
    <div className="flex flex-col gap-3">
      {subscriptions.map((sub) => {
        const charged = sub.charged !== null;
        return (
          <div key={sub.name} className="flex items-center gap-3">
            {/* Checkbox indicator */}
            <div
              className={`w-4 h-4 rounded-full border-2 flex items-center justify-center flex-shrink-0 transition-colors ${
                charged
                  ? "border-emerald-500 bg-emerald-500"
                  : "border-black/15 bg-transparent"
              }`}
            >
              {charged && (
                <svg
                  width="8"
                  height="8"
                  viewBox="0 0 12 12"
                  fill="none"
                  stroke="white"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M2 6l3 3 5-5" />
                </svg>
              )}
            </div>

            <span
              className={`text-xs flex-1 ${
                charged ? "text-black/70" : "text-black/35"
              }`}
            >
              {sub.name}
            </span>

            <span className="text-xs tabular-nums text-black/40">
              {charged
                ? visible
                  ? `£${sub.charged!.toFixed(2)}`
                  : "£••••"
                : visible
                ? `£${sub.expected.toFixed(2)} expected`
                : "£•••• expected"}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Main component ──

const TABS = ["Weekly", "Monthly", "Subs"] as const;

export default function Finances() {
  const [weekly, setWeekly] = useState<WeeklyData | null>(null);
  const [monthly, setMonthly] = useState<MonthlyCategory[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(true);
  const [activeTab, setActiveTab] = useState(0);

  const fetchFinance = useCallback(async () => {
    try {
      const res = await fetch(`/api/finance?_t=${Date.now()}`);
      const data = await res.json();
      if (data.weekly) setWeekly(data.weekly);
      if (data.monthly) setMonthly(data.monthly);
      if (data.subscriptions) setSubscriptions(data.subscriptions);
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
    <ComponentCard title="Finances" className="h-full" onRefresh={fetchFinance}>
      {/* Eye toggle */}
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

      {loading ? (
        <p className="text-xs text-black/40 py-2">Loading...</p>
      ) : (
        <>
          {/* Tab indicators */}
          <div className="flex gap-3 mb-3 -mt-1">
            {TABS.map((label, i) => (
              <button
                key={label}
                onClick={() => setActiveTab(i)}
                className={`text-[10px] font-semibold uppercase tracking-[0.12em] px-2.5 py-1 rounded-full transition-colors ${
                  activeTab === i
                    ? "bg-forest/10 text-forest"
                    : "text-black/25"
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Tab content */}
          {activeTab === 0 && (
            <div key="weekly" className="anim-fade">
              {weekly ? (
                <WeeklyPanel data={weekly} visible={visible} />
              ) : (
                <p className="text-xs text-black/40 py-2">No data for this month.</p>
              )}
            </div>
          )}

          {activeTab === 1 && (
            <div key="monthly" className="anim-fade">
              {monthly.length > 0 ? (
                <MonthlyPanel categories={monthly} visible={visible} />
              ) : (
                <p className="text-xs text-black/40 py-2">No data for this month.</p>
              )}
            </div>
          )}

          {activeTab === 2 && (
            <div key="subs" className="anim-fade">
              {subscriptions.length > 0 ? (
                <SubsPanel subscriptions={subscriptions} visible={visible} />
              ) : (
                <p className="text-xs text-black/40 py-2">No subscription data.</p>
              )}
            </div>
          )}
        </>
      )}
    </ComponentCard>
  );
}
