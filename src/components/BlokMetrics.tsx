"use client";

import { useState, useEffect, useCallback } from "react";
import ComponentCard from "./ComponentCard";

type BlokData = {
  totalSalesTY: number;
  totalSalesLY: number;
  sc90TrialsTY: number;
  sc90TrialsLY: number;
  asOfDate: string;
  metaSpend: number;
  googleSpend: number;
  totalAdSpend: number;
  blendedCAC: number;
};

function pctChange(ty: number, ly: number): number {
  if (ly === 0) return 0;
  return ((ty - ly) / ly) * 100;
}

function formatCurrency(n: number): string {
  return `£${n.toLocaleString("en-GB", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function formatDate(dateStr: string): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-GB", { day: "numeric", month: "short" });
}

function ChangeIndicator({ value }: { value: number }) {
  const positive = value >= 0;
  const color = positive ? "text-emerald-600" : "text-red-500";
  const arrow = positive ? "↑" : "↓";
  return (
    <span className={`text-xs font-medium ${color}`}>
      {arrow} {Math.abs(value).toFixed(1)}%
    </span>
  );
}

const REDACTED = "🙈🙊🙉";

export default function BlokMetrics() {
  const [data, setData] = useState<BlokData | null>(null);
  const [loading, setLoading] = useState(true);
  const [visible, setVisible] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/blok-metrics?_t=${Date.now()}`);
      const json = await res.json();
      if (!json.error) {
        setData(json);
      }
    } catch (err) {
      console.error("Failed to fetch BLOK metrics:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const salesChange = data ? pctChange(data.totalSalesTY, data.totalSalesLY) : 0;
  const trialsChange = data ? pctChange(data.sc90TrialsTY, data.sc90TrialsLY) : 0;

  return (
    <ComponentCard title="BLOK Metrics" className="col-span-2" onRefresh={fetchData}>
      {loading ? (
        <p className="text-xs text-black/40 py-2">Loading…</p>
      ) : !data ? (
        <p className="text-xs text-black/40 py-2">Unable to load metrics.</p>
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex justify-end -mt-2 mb-0">
            <button
              onClick={() => setVisible((v) => !v)}
              className="text-black/30 hover:text-black/50 transition-colors"
              aria-label={visible ? "Hide real data" : "Show real data"}
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

          {/* Three metric cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Total Sales */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                MTD Total Sales
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {visible ? formatCurrency(data.totalSalesTY) : REDACTED}
                </span>
                {visible && <ChangeIndicator value={salesChange} />}
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                vs {visible ? formatCurrency(data.totalSalesLY) : REDACTED} LY
              </div>
            </div>

            {/* SC90 Trials */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                MTD SC90 Trials
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {visible ? data.sc90TrialsTY : REDACTED}
                </span>
                {visible && <ChangeIndicator value={trialsChange} />}
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                vs {visible ? data.sc90TrialsLY : REDACTED} LY
              </div>
            </div>

            {/* Blended CAC */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                Blended CAC
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {visible ? formatCurrency(data.blendedCAC) : REDACTED}
                </span>
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                {visible
                  ? `${formatCurrency(data.metaSpend)} Meta + ${formatCurrency(data.googleSpend)} Google`
                  : `${REDACTED} Meta + ${REDACTED} Google`}
              </div>
            </div>
          </div>

          {/* Data freshness + privacy notice */}
          <div className="flex justify-between items-baseline">
            {!visible && (
              <div className="text-[10px] text-black/25 italic">
                Placeholder data for privacy — toggle real numbers with the eye icon above
              </div>
            )}
            <div className="text-[10px] text-black/25 text-right ml-auto">
              Sales data as of {formatDate(data.asOfDate)}
            </div>
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
