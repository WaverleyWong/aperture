"use client";

import { useMemo, useState } from "react";
import ComponentCard from "./ComponentCard";
import {
  WORKOUT_TEMPLATES,
  parseWeightKg,
  type ExerciseUnit,
  type WorkoutTemplate,
} from "@/lib/workoutTemplates";

const ACTIVITY_TYPES = [
  "Free Weights",
  "Barbell",
  "Free Weights with PT",
  "Class",
  "Online Class",
];

const FEEL_OPTIONS = [
  "Strong",
  "Started okay ended strong",
  "Started Low ended Decent-Strong",
  "Decent",
  "Started okay ended decent",
  "Okay",
  "Started Low ended Ok",
  "Decent but low capacity",
  "Okay but low capacity",
  "Started Decent ended Low",
  "Weak",
];

type Row = {
  id: string;
  name: string;
  unit: ExerciseUnit;
  sets: string;
  reps: string;
  weight: string;
  seconds: string;
  band: string;
  note: string;
  progression: boolean;
};

let rowSeq = 0;
function blankRow(unit: ExerciseUnit = "weight", name = ""): Row {
  rowSeq += 1;
  return {
    id: `row-${rowSeq}`,
    name,
    unit,
    sets: "",
    reps: "",
    weight: "",
    seconds: "",
    band: "",
    note: "",
    progression: false,
  };
}

function todayLondonISO(): string {
  // en-CA formats as yyyy-mm-dd, which a <input type="date"> expects.
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

const inputBase =
  "bg-white/80 border border-forest/15 rounded-lg px-2 py-1.5 text-sm text-black focus:outline-none focus:border-cerulean/60 transition-colors";

export default function AddWorkout() {
  const [open, setOpen] = useState(false);
  const [dayType, setDayType] = useState<string | null>(null);
  const [title, setTitle] = useState("");
  const [date, setDate] = useState(todayLondonISO());
  const [activityType, setActivityType] = useState("Free Weights");
  const [feel, setFeel] = useState("");
  const [progression, setProgression] = useState(false);
  const [notes, setNotes] = useState("");
  const [rows, setRows] = useState<Row[]>([]);
  const [publishing, setPublishing] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  const resetForm = () => {
    setDayType(null);
    setTitle("");
    setDate(todayLondonISO());
    setActivityType("Free Weights");
    setFeel("");
    setProgression(false);
    setNotes("");
    setRows([]);
  };

  const pickDay = (tpl: WorkoutTemplate) => {
    setDayType(tpl.dayType);
    setTitle(tpl.title);
    setActivityType(tpl.activityType);
    setRows(tpl.exercises.map((ex) => blankRow(ex.unit, ex.name)));
  };

  const updateRow = (id: string, patch: Partial<Row>) =>
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  const removeRow = (id: string) =>
    setRows((prev) => prev.filter((r) => r.id !== id));

  const addRow = () => setRows((prev) => [...prev, blankRow()]);

  // ── Live totals ──
  const totals = useMemo(() => {
    let sets = 0;
    let reps = 0;
    let volume = 0;
    for (const r of rows) {
      const s = parseInt(r.sets, 10) || 0;
      const rp = parseInt(r.reps, 10) || 0;
      sets += s;
      if (r.unit !== "seconds") reps += s * rp;
      if (r.unit === "weight") {
        const kg = parseWeightKg(r.weight);
        if (kg != null) volume += s * rp * kg;
      }
    }
    return { sets, reps, volume: Math.round(volume) };
  }, [rows]);

  const publish = async () => {
    if (!dayType || publishing) return;
    setPublishing(true);
    setToast(null);
    try {
      const res = await fetch("/api/training", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: title.trim() || dayType,
          date,
          dayType,
          activityType,
          type: "Strength",
          feel: feel || undefined,
          progression,
          notes,
          exercises: rows.map((r) => ({
            name: r.name,
            unit: r.unit,
            sets: parseInt(r.sets, 10) || 0,
            reps: parseInt(r.reps, 10) || 0,
            weight: r.weight,
            seconds: parseInt(r.seconds, 10) || 0,
            band: r.band,
            note: r.note,
            progression: r.progression,
          })),
        }),
      });
      const data = await res.json();
      if (data.success) {
        setToast(`Published “${title.trim() || dayType}” to Notion`);
        resetForm();
        setOpen(false);
      } else {
        setToast(data.error || "Failed to publish");
      }
    } catch {
      setToast("Failed to publish");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <>
      {/* ── Tile ── */}
      <ComponentCard title="Training">
        <button
          onClick={() => setOpen(true)}
          className="anim-tap flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-forest text-white text-sm font-semibold hover:bg-forest/90 transition-colors"
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <line x1="12" y1="5" x2="12" y2="19" />
            <line x1="5" y1="12" x2="19" y2="12" />
          </svg>
          Add Workout
        </button>
        <p className="text-xs text-black/40 mt-2 text-center">
          Pick a day, tweak the sets, publish to Notion.
        </p>
      </ComponentCard>

      {/* ── Toast ── */}
      {toast && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[70] flex items-center gap-3 bg-black/85 text-white rounded-xl px-4 py-3 shadow-lg backdrop-blur-sm anim-fade">
          <span className="text-sm">{toast}</span>
          <button onClick={() => setToast(null)} className="text-white/40 hover:text-white/70 text-xs ml-1" aria-label="Dismiss">✕</button>
        </div>
      )}

      {/* ── Modal ── */}
      {open && (
        <div className="fixed inset-0 z-[60] flex items-start md:items-center justify-center bg-black/40 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="bg-beige rounded-3xl border border-forest/10 shadow-xl w-full max-w-2xl my-4 max-h-[92vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-5 py-4 border-b border-forest/10 shrink-0">
              <h2 className="text-xs font-semibold uppercase tracking-[0.15em] text-forest">Add Workout</h2>
              <button
                onClick={() => setOpen(false)}
                className="text-black/30 hover:text-black/60 transition-colors"
                aria-label="Close"
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>
            </div>

            {/* Scrollable body */}
            <div className="flex-1 overflow-y-auto component-scroll px-5 py-4 flex flex-col gap-4">
              {/* Day type pills */}
              <div>
                <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Day type</label>
                <div className="flex flex-wrap gap-2 mt-2">
                  {WORKOUT_TEMPLATES.map((tpl) => (
                    <button
                      key={tpl.dayType}
                      onClick={() => pickDay(tpl)}
                      className={`anim-tap text-xs font-semibold rounded-full px-3 py-1.5 border transition-colors ${
                        dayType === tpl.dayType
                          ? "bg-forest text-white border-forest"
                          : "bg-white/70 text-forest border-forest/20 hover:border-forest/50"
                      }`}
                    >
                      {tpl.dayType}
                    </button>
                  ))}
                </div>
              </div>

              {dayType && (
                <>
                  {/* Meta fields */}
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Title</label>
                      <input value={title} onChange={(e) => setTitle(e.target.value)} className={inputBase} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Date</label>
                      <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputBase} />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Activity type</label>
                      <select value={activityType} onChange={(e) => setActivityType(e.target.value)} className={inputBase}>
                        {ACTIVITY_TYPES.map((a) => <option key={a} value={a}>{a}</option>)}
                      </select>
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Feel</label>
                      <select value={feel} onChange={(e) => setFeel(e.target.value)} className={inputBase}>
                        <option value="">—</option>
                        {FEEL_OPTIONS.map((f) => <option key={f} value={f}>{f}</option>)}
                      </select>
                    </div>
                  </div>

                  {/* Exercise rows */}
                  <div className="flex flex-col gap-2">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Exercises</label>
                    {rows.map((r) => (
                      <div key={r.id} className="bg-white/60 border border-forest/10 rounded-xl p-2.5 flex flex-col gap-2">
                        <div className="flex items-center gap-2">
                          <input
                            value={r.name}
                            onChange={(e) => updateRow(r.id, { name: e.target.value })}
                            placeholder="Exercise"
                            className={`${inputBase} flex-1 font-medium`}
                          />
                          <select
                            value={r.unit}
                            onChange={(e) => updateRow(r.id, { unit: e.target.value as ExerciseUnit })}
                            className={`${inputBase} w-[110px]`}
                            title="Measure type"
                          >
                            <option value="weight">Weight</option>
                            <option value="bodyweight">Bodyweight</option>
                            <option value="seconds">Seconds</option>
                            <option value="band">Band</option>
                          </select>
                          <button
                            onClick={() => removeRow(r.id)}
                            className="anim-tap text-black/25 hover:text-red-500 transition-colors p-1"
                            aria-label="Remove exercise"
                          >
                            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polyline points="3 6 5 6 21 6" />
                              <path d="M19 6l-1 14a2 2 0 01-2 2H8a2 2 0 01-2-2L5 6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2" />
                            </svg>
                          </button>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          <FieldNum label="Sets" value={r.sets} onChange={(v) => updateRow(r.id, { sets: v })} />
                          {r.unit === "seconds" ? (
                            <FieldNum label="Seconds" value={r.seconds} onChange={(v) => updateRow(r.id, { seconds: v })} />
                          ) : (
                            <>
                              <FieldNum label="Reps" value={r.reps} onChange={(v) => updateRow(r.id, { reps: v })} />
                              {r.unit === "weight" && (
                                <FieldText label="Weight" placeholder="22kg / 2x11kg" value={r.weight} onChange={(v) => updateRow(r.id, { weight: v })} />
                              )}
                              {r.unit === "band" && (
                                <FieldText label="Band" placeholder="e.g. red / medium" value={r.band} onChange={(v) => updateRow(r.id, { band: v })} />
                              )}
                            </>
                          )}
                          <button
                            onClick={() => updateRow(r.id, { progression: !r.progression })}
                            className={`anim-tap text-[11px] font-semibold rounded-md px-2 py-1.5 border transition-colors ${
                              r.progression
                                ? "bg-cerulean text-white border-cerulean"
                                : "bg-white/70 text-cerulean border-cerulean/30 hover:bg-cerulean/5"
                            }`}
                            title="Progressed on last round (+/-)"
                          >
                            ▲ Progression
                          </button>
                        </div>

                        <input
                          value={r.note}
                          onChange={(e) => updateRow(r.id, { note: e.target.value })}
                          placeholder="Note (e.g. +1 rep, form cue)…"
                          className={`${inputBase} w-full`}
                        />
                      </div>
                    ))}

                    <button
                      onClick={addRow}
                      className="anim-tap self-start text-xs font-semibold text-forest border border-forest/25 rounded-lg px-3 py-1.5 hover:bg-forest/5 transition-colors"
                    >
                      + Add exercise
                    </button>
                  </div>

                  {/* Session notes */}
                  <div className="flex flex-col gap-1">
                    <label className="text-[10px] uppercase tracking-wider font-semibold text-forest/60">Session notes</label>
                    <textarea
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Overall notes for this session…"
                      rows={2}
                      className={`${inputBase} resize-none`}
                    />
                  </div>

                  {/* Session-level progression */}
                  <label className="flex items-center gap-2 text-sm text-black/70 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={progression}
                      onChange={(e) => setProgression(e.target.checked)}
                      className="accent-cerulean w-4 h-4"
                    />
                    Progression this session
                  </label>
                </>
              )}
            </div>

            {/* Footer: totals + publish */}
            {dayType && (
              <div className="shrink-0 border-t border-forest/10 px-5 py-3 flex flex-col sm:flex-row items-center justify-between gap-3">
                <div className="flex items-center gap-4 text-xs text-forest/70">
                  <span><strong className="text-forest">{totals.sets}</strong> sets</span>
                  <span><strong className="text-forest">{totals.reps}</strong> reps</span>
                  <span><strong className="text-forest">{totals.volume}</strong> kg vol</span>
                </div>
                <button
                  onClick={publish}
                  disabled={publishing}
                  className="anim-tap w-full sm:w-auto bg-cerulean text-white text-sm font-semibold rounded-xl px-5 py-2.5 hover:bg-cerulean/90 transition-colors disabled:opacity-50"
                >
                  {publishing ? "Publishing…" : "Publish to Notion"}
                </button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function FieldNum({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-forest/50">{label}</span>
      <input
        type="number"
        inputMode="numeric"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} w-16`}
      />
    </label>
  );
}

function FieldText({ label, value, placeholder, onChange }: { label: string; value: string; placeholder?: string; onChange: (v: string) => void }) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider font-semibold text-forest/50">{label}</span>
      <input
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className={`${inputBase} w-28`}
      />
    </label>
  );
}
