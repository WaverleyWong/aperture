"use client";

import { useEffect, useState } from "react";
import ComponentCard from "./ComponentCard";

const SHEET_CSV_URL =
  "https://docs.google.com/spreadsheets/d/e/2PACX-1vTHq-ibcAS5aOefw9hdSDp4xHDFtpV8L6ymcDlCyUHy-fIhjunztjhPqOMksQrNSmHqku80JOV8idtG/pub?output=csv";

function parseDateCell(raw: string): string | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Normalise separators — the sheet uses "/" but some cells have typos
  const parts = trimmed.replace(/[-/.]/g, "/").split("/");
  if (parts.length !== 3) return null;

  let [d, m, y] = parts.map((p) => parseInt(p, 10));
  if (isNaN(d) || isNaN(m) || isNaN(y)) return null;

  // Two-digit year → four-digit
  if (y < 100) y += 2000;

  // Return ISO-style key dd/mm/yyyy for comparison
  return `${d}/${m}/${y}`;
}

function todayKey(): string {
  const now = new Date();
  return `${now.getDate()}/${now.getMonth() + 1}/${now.getFullYear()}`;
}

export default function CalorieTracker() {
  const [eaten, setEaten] = useState<number | null>(null);
  const [target, setTarget] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch(SHEET_CSV_URL);
        const text = await res.text();
        const rows = text.split("\n").map((r) => r.split(","));

        const key = todayKey();

        for (let i = 1; i < rows.length; i++) {
          const row = rows[i];
          if (!row[0]) continue;
          const rowKey = parseDateCell(row[0]);
          if (rowKey === key) {
            const targetVal = parseFloat(row[2]);
            const countVal = parseFloat(row[3]);
            setTarget(isNaN(targetVal) ? null : targetVal);
            setEaten(isNaN(countVal) ? null : countVal);
            break;
          }
        }
      } catch {
        setError("Failed to load data");
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const pct =
    eaten != null && target != null
      ? Math.min(Math.round((eaten / target) * 100), 100)
      : 0;

  return (
    <ComponentCard title="Calories">
      {loading ? (
        <p className="text-sm text-black/40">Loading…</p>
      ) : error ? (
        <p className="text-sm text-red-500">{error}</p>
      ) : eaten == null ? (
        <p className="text-sm text-black/40">No entry for today yet</p>
      ) : (
        <div className="flex items-baseline gap-1.5 mb-4">
          <span className="text-3xl font-light tabular-nums text-black">
            {Math.round(eaten)}
          </span>
          {target != null && (
            <span className="text-sm font-light text-black/30">/ {target}</span>
          )}
        </div>
      )}
    </ComponentCard>
  );
}
