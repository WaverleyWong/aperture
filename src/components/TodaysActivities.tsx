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
    </ComponentCard>
  );
}
