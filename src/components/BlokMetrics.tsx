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

export default function BlokMetrics() {
  const [data, setData] = useState<BlokData | null>(null);
  const [loading, setLoading] = useState(true);

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
          {/* Three metric cards */}
          <div className="grid grid-cols-3 gap-4">
            {/* Total Sales */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                MTD Total Sales
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {formatCurrency(data.totalSalesTY)}
                </span>
                <ChangeIndicator value={salesChange} />
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                vs {formatCurrency(data.totalSalesLY)} LY
              </div>
            </div>

            {/* SC90 Trials */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                MTD SC90 Trials
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {data.sc90TrialsTY}
                </span>
                <ChangeIndicator value={trialsChange} />
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                vs {data.sc90TrialsLY} LY
              </div>
            </div>

            {/* Blended CAC */}
            <div className="rounded-2xl bg-forest/[0.03] border border-forest/[0.06] px-4 py-3">
              <div className="text-[10px] uppercase tracking-[0.12em] text-black/40 mb-2">
                Blended CAC
              </div>
              <div className="flex items-baseline gap-2 mb-1">
                <span className="text-lg font-semibold tabular-nums text-black/85">
                  {formatCurrency(data.blendedCAC)}
                </span>
              </div>
              <div className="text-[10px] tabular-nums text-black/30">
                {formatCurrency(data.metaSpend)} Meta + {formatCurrency(data.googleSpend)} Google
              </div>
            </div>
          </div>

          {/* Data freshness */}
          <div className="text-[10px] text-black/25 text-right">
            Sales data as of {formatDate(data.asOfDate)}
          </div>
        </div>
      )}
    </ComponentCard>
  );
}
