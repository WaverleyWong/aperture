import { Client } from "@notionhq/client";
import { NextResponse } from "next/server";
import { parseWeightKg, type ExerciseUnit } from "@/lib/workoutTemplates";

export const dynamic = "force-dynamic";

const notion = new Client({ auth: process.env.NOTION_API_KEY });

// Parent database for the "training" data source.
const TRAINING_DB_ID =
  process.env.NOTION_TRAINING_DB_ID || "01fa75d5-ce09-4eba-9c81-d95e02e308f3";

interface ExerciseInput {
  name: string;
  unit: ExerciseUnit;
  sets: number;
  reps: number;
  weight: string; // raw, e.g. "22kg" or "2x11kg"
  seconds: number;
  band: string;
  note: string;
  progression: boolean;
}

interface WorkoutInput {
  title: string;
  date: string; // ISO yyyy-mm-dd
  dayType: string;
  activityType: string;
  type?: string;
  feel?: string;
  progression: boolean;
  notes?: string;
  exercises: ExerciseInput[];
}

function txt(content: string) {
  return content ? [{ type: "text" as const, text: { content } }] : [];
}

function formatDate(iso: string): string {
  // Render as e.g. "Friday, 26 June 2026" in Europe/London.
  const d = new Date(`${iso}T12:00:00`);
  return d.toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

// What the "Weight" column shows for each unit type.
function weightCell(ex: ExerciseInput): string {
  switch (ex.unit) {
    case "seconds":
      return ex.seconds ? `${ex.seconds}s` : "";
    case "bodyweight":
      return "BW";
    case "band":
      return ex.band || "";
    default:
      return ex.weight || "";
  }
}

function repsCell(ex: ExerciseInput): string {
  if (ex.unit === "seconds") return "";
  return ex.reps ? String(ex.reps) : "";
}

function noteCell(ex: ExerciseInput): string {
  const marker = ex.progression ? "▲ " : "";
  return `${marker}${ex.note || ""}`.trim();
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as WorkoutInput;

    if (!body.dayType || !Array.isArray(body.exercises)) {
      return NextResponse.json({ error: "Invalid workout payload" }, { status: 400 });
    }

    // Authoritative totals computed server-side.
    let totalSets = 0;
    let totalReps = 0;
    let volume = 0;
    for (const ex of body.exercises) {
      const sets = Number(ex.sets) || 0;
      const reps = Number(ex.reps) || 0;
      totalSets += sets;
      if (ex.unit !== "seconds") totalReps += sets * reps;
      if (ex.unit === "weight") {
        const kg = parseWeightKg(ex.weight);
        if (kg != null) volume += sets * reps * kg;
      }
    }
    volume = Math.round(volume);

    // ── Page body: exercise table + notes callout ──
    const headerRow = {
      object: "block" as const,
      type: "table_row" as const,
      table_row: {
        cells: [txt("Exercise"), txt("Sets"), txt("Reps"), txt("Weight"), txt("Note")],
      },
    };

    const exerciseRows = body.exercises
      .filter((ex) => (ex.name || "").trim().length > 0)
      .map((ex) => ({
        object: "block" as const,
        type: "table_row" as const,
        table_row: {
          cells: [
            txt(ex.name),
            txt(ex.sets ? String(ex.sets) : ""),
            txt(repsCell(ex)),
            txt(weightCell(ex)),
            txt(noteCell(ex)),
          ],
        },
      }));

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const children: any[] = [
      {
        object: "block",
        type: "table",
        table: {
          table_width: 5,
          has_column_header: true,
          has_row_header: false,
          children: [headerRow, ...exerciseRows],
        },
      },
    ];

    if (body.notes && body.notes.trim()) {
      children.push({ object: "block", type: "divider", divider: {} });
      children.push({
        object: "block",
        type: "callout",
        callout: {
          rich_text: txt(`${formatDate(body.date)}  ·  Notes`),
          color: "gray_background",
        },
      });
      for (const line of body.notes.split("\n")) {
        children.push({
          object: "block",
          type: "paragraph",
          paragraph: { rich_text: txt(line) },
        });
      }
    }

    // ── Properties ──
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const properties: Record<string, any> = {
      Name: { title: [{ text: { content: body.title || body.dayType } }] },
      Date: { date: { start: body.date } },
      "Day Type": { select: { name: body.dayType } },
      Type: { select: { name: body.type || "Strength" } },
      "Total Sets": { number: totalSets },
      "Total Reps": { number: totalReps },
      "Volume kg": { number: volume },
      Progression: { checkbox: !!body.progression },
    };
    if (body.activityType) {
      properties["Activity Type"] = { select: { name: body.activityType } };
    }
    if (body.feel) {
      properties.Feel = { select: { name: body.feel } };
    }

    const page = await notion.pages.create({
      parent: { database_id: TRAINING_DB_ID },
      icon: { type: "emoji", emoji: "🏋️‍♂️" },
      properties,
      children,
    });

    return NextResponse.json({
      success: true,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      url: (page as any).url,
      totals: { totalSets, totalReps, volume },
    });
  } catch (error: unknown) {
    console.error("Training publish error:", error);
    return NextResponse.json({ error: "Failed to publish workout" }, { status: 500 });
  }
}
