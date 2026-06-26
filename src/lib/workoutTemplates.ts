// Workout day templates for the "Add Workout" dashboard tile.
//
// These are *editable defaults* — picking a day type pre-populates these rows,
// but every field (name, sets, reps, weight, unit) can be changed in the modal.
//
// `unit` controls which fields a row shows and whether it counts toward volume:
//   - "weight":     Sets + Reps + Weight (kg). Counts toward Volume kg.
//   - "bodyweight": Sets + Reps only ("no measure" movements). No weight, no volume.
//   - "seconds":    Sets + Duration (seconds) instead of reps/weight. No volume.
//   - "band":       Sets + Reps + Band difficulty (text). No volume.

export type ExerciseUnit = "weight" | "bodyweight" | "seconds" | "band";

export interface TemplateExercise {
  name: string;
  unit: ExerciseUnit;
}

export interface WorkoutTemplate {
  /** Value stored in the Notion "Day Type" select. */
  dayType: string;
  /** Default page title (matches existing entries, e.g. "Leg Day - Open Gym"). */
  title: string;
  /** Default Notion "Activity Type" select value. */
  activityType: string;
  exercises: TemplateExercise[];
}

const W = (name: string): TemplateExercise => ({ name, unit: "weight" });
const BW = (name: string): TemplateExercise => ({ name, unit: "bodyweight" });
const SEC = (name: string): TemplateExercise => ({ name, unit: "seconds" });
const BAND = (name: string): TemplateExercise => ({ name, unit: "band" });

export const WORKOUT_TEMPLATES: WorkoutTemplate[] = [
  {
    dayType: "Pull A",
    title: "Pull A",
    activityType: "Free Weights",
    exercises: [
      SEC("Dead Hang"),
      BW("Scapula Pulls"),
      BAND("Band Assisted Pull Ups"),
      SEC("Negatives"),
      W("Bent Over Rows"),
      W("Bicep Curls"),
      W("Hammer Curls"),
      W("Wrist Curls"),
    ],
  },
  {
    dayType: "Pull B",
    title: "Pull B",
    activityType: "Free Weights",
    exercises: [
      SEC("Dead Hang"),
      BW("Scapula Pulls"),
      BAND("Band Assisted Pull Ups"),
      W("Rear Delt Rows"),
      W("DB Shrugs"),
      W("Preacher Curls"),
      W("Wrist Curls"),
    ],
  },
  {
    dayType: "Push A",
    title: "Push A",
    activityType: "Free Weights",
    exercises: [
      BW("Wide Press Ups"),
      BW("Pike Push Ups"),
      W("Elevated Feet Dips"),
      W("Chest Press"),
      W("DB Hammer Press"),
      W("Overhead Tricep Pullover"),
      W("Lateral Raises"),
    ],
  },
  {
    dayType: "Push B",
    title: "Push B",
    activityType: "Free Weights",
    exercises: [
      BW("Pike Push Ups"),
      W("Shoulder Press"),
      W("Incline Chest Press"),
      W("Front Raises"),
      W("Skullcrushers"),
      W("Decline Push-ups"),
    ],
  },
  {
    dayType: "Push C",
    title: "Push C",
    activityType: "Free Weights",
    exercises: [
      BW("Feet Elevated Push Ups"),
      BW("Feet Elevated Pike Push Ups"),
      W("Shoulder Press"),
      W("Chest Press"),
      W("DB Hammer Press"),
      W("Elevated Feet Dips"),
      W("Front Raises"),
      W("Lateral Raises"),
    ],
  },
  {
    dayType: "Leg Day Open Gym",
    title: "Leg Day - Open Gym",
    activityType: "Barbell",
    exercises: [
      W("Deadlifts"),
      W("Squats"),
      W("RDLs"),
      W("Hip Thrusts"),
      W("Leg Curls"),
    ],
  },
  {
    dayType: "Leg Day",
    title: "Leg Day",
    activityType: "Free Weights",
    exercises: [
      W("Squats"),
      W("Bulgarian Split Squats"),
      W("RDLs"),
      W("Calf Raises"),
      W("Hip Thrusts"),
    ],
  },
];

/** Parse a weight string into kilograms for volume.
 *  "22" / "22kg" -> 22 ; "2x11kg" / "2 x 11" -> 22 (two dumbbells) ; else null. */
export function parseWeightKg(raw: string): number | null {
  if (!raw) return null;
  const cleaned = raw.toLowerCase().replace(/kg/g, "").trim();
  const parts = cleaned.split(/x|×/).map((p) => parseFloat(p.trim()));
  if (parts.some((n) => isNaN(n))) return null;
  if (parts.length === 1) return parts[0];
  // "2x11" => 2 dumbbells of 11kg => 22kg of load moved
  return parts.reduce((a, b) => a * b, 1);
}
