"use client";

import { useEffect, useState, useCallback } from "react";
import ComponentCard from "./ComponentCard";

interface CalendarEvent {
  time: string;
  label: string;
  isAllDay: boolean;
  source: "work" | "personal";
}

export default function TodaysActivities() {
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchEvents = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/calendar");
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else {
        setEvents(data.events);
      }
    } catch {
      setError("Failed to fetch calendar");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchEvents();
  }, [fetchEvents]);

  return (
    <ComponentCard title="Today's Activities">
      <div className="flex flex-col gap-2">
        {loading && (
          <p className="text-xs text-black/40 italic">Loading…</p>
        )}
        {error && (
          <p className="text-xs text-red-500 italic">{error}</p>
        )}
        {!loading && !error && events.length === 0 && (
          <p className="text-xs text-black/40 italic">Nothing scheduled today</p>
        )}
        {events.map((evt, i) => (
          <div key={i} className="flex items-center gap-2.5">
            <span
              className="w-1.5 h-1.5 rounded-full flex-shrink-0"
              style={{
                backgroundColor: evt.source === "work" ? "#007ea7" : "#0e402d",
              }}
            />
            <span className="text-xs tabular-nums text-black/40 w-10 flex-shrink-0">
              {evt.time}
            </span>
            <span className="text-sm text-black">{evt.label}</span>
          </div>
        ))}
      </div>

      {/* Decorative wave with colour fill to bottom */}
      <div className="mt-auto mx-[-20px] mb-[-20px] flex-1 flex flex-col min-h-[60px]">
        {/* Wave SVG — transparent above, filled below */}
        <svg
          className="w-full block"
          viewBox="0 0 200 36"
          preserveAspectRatio="none"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
        >
          {/* Only fill below the wave curve */}
          <path
            d="M0 20 C25 8, 50 8, 75 20 S125 32, 150 20 S175 8, 200 20 L200 36 L0 36 Z"
            fill="rgba(0,126,167,0.10)"
          />
          {/* Wave line */}
          <path
            d="M0 20 C25 8, 50 8, 75 20 S125 32, 150 20 S175 8, 200 20"
            stroke="#007ea7"
            strokeWidth="1"
            strokeLinecap="round"
            opacity="0.18"
          />
          {/* Second subtle wave */}
          <path
            d="M0 27 C30 17, 55 17, 80 27 S130 37, 155 27 S180 17, 200 27"
            stroke="#007ea7"
            strokeWidth="0.75"
            strokeLinecap="round"
            opacity="0.10"
          />
        </svg>
        {/* Solid fill stretches to bottom */}
        <div className="flex-1" style={{ background: "rgba(0,126,167,0.10)" }} />
      </div>
    </ComponentCard>
  );
}
