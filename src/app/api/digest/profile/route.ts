import { NextResponse } from "next/server";
import { runMigrations } from "@/db/migrate";
import { STATE, getProfile, readState, writeState } from "@/lib/digest";

export const dynamic = "force-dynamic";

interface ProfileVersion {
  text: string;
  updatedAt: string;
}

export async function GET() {
  try {
    await runMigrations();
    const [text, history, suggestions] = await Promise.all([
      getProfile(),
      readState<ProfileVersion[]>(STATE.profileHistory, []),
      readState<{
        generatedAt?: string;
        rarelyLiked?: string[];
        wildcardWinners?: string[];
      } | null>(STATE.suggestions, null),
    ]);
    const current = await readState<ProfileVersion | null>(STATE.profile, null);

    return NextResponse.json({
      text,
      updatedAt: current?.updatedAt || null,
      history,
      suggestions,
    });
  } catch (error) {
    console.error("Profile read error:", error);
    return NextResponse.json({ text: "", updatedAt: null, history: [], suggestions: null });
  }
}

/** Manual edit — the previous version is kept in history. */
export async function PUT(request: Request) {
  try {
    const { text } = await request.json();
    if (typeof text !== "string" || !text.trim()) {
      return NextResponse.json({ error: "Profile cannot be empty" }, { status: 400 });
    }

    await runMigrations();
    const previous = await readState<ProfileVersion | null>(STATE.profile, null);
    if (previous?.text) {
      const history = await readState<ProfileVersion[]>(STATE.profileHistory, []);
      await writeState(STATE.profileHistory, [previous, ...history].slice(0, 12));
    }

    await writeState(STATE.profile, {
      text: text.trim(),
      updatedAt: new Date().toISOString(),
    });
    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Profile write error:", error);
    return NextResponse.json({ error: "Failed to save profile" }, { status: 500 });
  }
}
