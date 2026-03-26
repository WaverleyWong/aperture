"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import ComponentCard from "./ComponentCard";

const SHEET_CSV_URL = process.env.NEXT_PUBLIC_CALORIE_CSV_URL!;

type WeightEntry = { date: string; weight: number };

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.replace(/[-/.]/g, "/").split("/");
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (y < 100) y += 2000;
  return `${d}/${m}/${y}`;
}

function parseDateToObj(raw: string): Date | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const parts = trimmed.replace(/[-/.]/g, "/").split("/");
  if (parts.length !== 3) return null;
  let [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;
  if (y < 100) y += 2000;
  return new Date(y, m - 1, d);
}

function todayKey(): string {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

function formatShortDate(dateStr: string): string {
  const parts = dateStr.split("/");
  return `${parts[0]}/${parts[1]}`;
}

// Simple SVG line chart
function WeightChart({ data }: { data: WeightEntry[] }) {
  if (data.length < 2) return <p className="text-sm text-black/40">Not enough data</p>;

  const W = 280;
  const H = 120;
  const PAD_X = 30;
  const PAD_Y = 15;
  const chartW = W - PAD_X * 2;
  const chartH = H - PAD_Y * 2;

  const weights = data.map((d) => d.weight);
  const minW = Math.floor(Math.min(...weights) - 0.5);
  const maxW = Math.ceil(Math.max(...weights) + 0.5);
  const range = maxW - minW || 1;

  const points = data.map((entry, i) => {
    const x = PAD_X + (i / (data.length - 1)) * chartW;
    const y = PAD_Y + chartH - ((entry.weight - minW) / range) * chartH;
    return { x, y, ...entry };
  });

  const linePath = points.map((p, i) => `${i === 0 ? "M" : "L"} ${p.x} ${p.y}`).join(" ");

  // Y-axis labels
  const yLabels = [minW, minW + range / 2, maxW];

  // X-axis: show first, middle, last
  const xIndices = [0, Math.floor(data.length / 2), data.length - 1];

  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="w-full h-auto" preserveAspectRatio="xMidYMid meet">
      {/* Grid lines */}
      {yLabels.map((val) => {
        const y = PAD_Y + chartH - ((val - minW) / range) * chartH;
        return (
          <g key={val}>
            <line x1={PAD_X} y1={y} x2={W - PAD_X} y2={y} stroke="black" strokeOpacity="0.06" strokeWidth="0.5" />
            <text x={PAD_X - 4} y={y + 3} textAnchor="end" fontSize="7" fill="black" fillOpacity="0.3">
              {val.toFixed(1)}
            </text>
          </g>
        );
      })}

      {/* X-axis labels */}
      {xIndices.map((idx) => (
        <text
          key={idx}
          x={points[idx].x}
          y={H - 2}
          textAnchor="middle"
          fontSize="7"
          fill="black"
          fillOpacity="0.3"
        >
          {formatShortDate(data[idx].date)}
        </text>
      ))}

      {/* Line */}
      <path d={linePath} fill="none" stroke="#007ea7" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />

      {/* Dots */}
      {points.map((p, i) => (
        <circle key={i} cx={p.x} cy={p.y} r="2" fill="#007ea7" />
      ))}
    </svg>
  );
}

export default function Vitals() {
  const [eaten, setEaten] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [weightData, setWeightData] = useState<WeightEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(SHEET_CSV_URL);
      const text = await res.text();
      const rows = text.split("\n").map((r) => r.split(","));

      const key = todayKey();
      let found = false;

      const now = new Date();
      const thirtyDaysAgo = new Date(now);
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

      const weights: WeightEntry[] = [];

      for (let i = 1; i < rows.length; i++) {
        const row = rows[i];
        if (!row[0]) continue;
        const rowKey = parseDateCell(row[0]);
        if (!rowKey) continue;

        // Calorie match for today
        if (rowKey === key) {
          const targetVal = parseFloat(row[2]);
          const countVal = parseFloat(row[3]);
          setTarget(isNaN(targetVal) ? null : targetVal);
          setEaten(isNaN(countVal) ? null : countVal);
          found = true;
        }

        // Weight data (column 8 = index 8)
        const weightVal = parseFloat(row[8]);
        if (!isNaN(weightVal) && weightVal > 0) {
          const dateObj = parseDateToObj(row[0]);
          if (dateObj && dateObj >= thirtyDaysAgo && dateObj <= now) {
            weights.push({ date: rowKey, weight: weightVal });
          }
        }
      }

      if (!found) {
        setEaten(null);
        setTarget(null);
      }
      setWeightData(weights);
    } catch {
      setError("Failed to load data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Scroll tracking
  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    let ticking = false;
    const onScroll = () => {
      if (ticking) return;
      ticking = true;
      requestAnimationFrame(() => {
        const index = Math.round(el.scrollLeft / el.clientWidth);
        setActiveTab(index);
        ticking = false;
      });
    };
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  const scrollTo = (index: number) => {
    scrollRef.current?.scrollTo({ left: scrollRef.current.clientWidth * index, behavior: "smooth" });
  };

  const currentWeight = weightData.length > 0 ? weightData[weightData.length - 1].weight : null;
  const oldestWeight = weightData.length > 0 ? weightData[0].weight : null;
  const weightChange = currentWeight && oldestWeight ? currentWeight - oldestWeight : null;

  return (
    <ComponentCard title="Vitals" onRefresh={fetchData}>
      {loading ? (
        <p className="text-sm text-black/40">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : (
        <>
          {/* Tab indicators */}
          <div className="flex gap-3 mb-3 -mt-1">
            {["Progress", "Calories"].map((label, i) => (
              <button
                key={label}
                onClick={() => scrollTo(i)}
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

          {/* Swipeable panels */}
          <div
            ref={scrollRef}
            className="flex overflow-x-auto snap-x snap-mandatory scrollbar-none -mx-1"
            style={{ WebkitOverflowScrolling: "touch" }}
          >
            {/* Panel 1: Weight Progress */}
            <div className="w-full flex-shrink-0 snap-center px-1">
              {weightData.length < 2 ? (
                <p className="text-sm text-black/40">Not enough weight data yet</p>
              ) : (
                <div className="flex flex-col gap-2">
                  <div className="flex items-baseline gap-3">
                    {currentWeight && (
                      <span className="text-2xl font-light tabular-nums text-black">
                        {currentWeight.toFixed(1)}
                        <span className="text-sm text-black/30 ml-1">kg</span>
                      </span>
                    )}
                    {weightChange !== null && (
                      <span className={`text-xs font-medium ${weightChange <= 0 ? "text-emerald-600" : "text-red-500"}`}>
                        {weightChange > 0 ? "+" : ""}{weightChange.toFixed(1)} kg
                      </span>
                    )}
                  </div>
                  <WeightChart data={weightData} />
                </div>
              )}
            </div>

            {/* Panel 2: Calories */}
            <div className="w-full flex-shrink-0 snap-center px-1">
              {eaten == null ? (
                <p className="text-sm text-black/40">No entry for today yet</p>
              ) : (
                <div className="flex items-baseline gap-1.5">
                  <span className="text-3xl font-light tabular-nums text-black">
                    {Math.round(eaten)}
                  </span>
                  {target != null && (
                    <span className="text-sm font-light text-black/30">/ {target}</span>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </ComponentCard>
  );
}
