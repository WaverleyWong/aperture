import { NextResponse } from "next/server";
import { runMigrations } from "@/db/migrate";
import { STATE, getSources, isUnhealthy, readState, writeState, type SourceHealth } from "@/lib/digest";
import type { DigestSource } from "@/lib/digestSources";

export const dynamic = "force-dynamic";

/** The editable source list, annotated with health so dead feeds are visible. */
export async function GET() {
  try {
    await runMigrations();
    const [sources, health] = await Promise.all([
      getSources(),
      readState<Record<string, SourceHealth>>(STATE.health, {}),
    ]);

    return NextResponse.json({
      sources,
      health,
      unhealthy: sources.filter((s) => isUnhealthy(health[s.id])).map((s) => s.name),
    });
  } catch (error) {
    console.error("Sources read error:", error);
    return NextResponse.json({ sources: [], health: {}, unhealthy: [] });
  }
}

/** Replaces the whole list. Validated enough that a typo can't wedge the job. */
export async function PUT(request: Request) {
  try {
    const { sources } = await request.json();
    if (!Array.isArray(sources) || sources.length === 0) {
      return NextResponse.json({ error: "Need at least one source" }, { status: 400 });
    }

    const cleaned: DigestSource[] = [];
    for (const raw of sources) {
      const id = String(raw?.id || "").trim();
      const name = String(raw?.name || "").trim();
      const url = String(raw?.url || "").trim();
      if (!id || !name || !/^https?:\/\//i.test(url)) {
        return NextResponse.json(
          { error: `Each source needs an id, a name and an http(s) url — check "${name || id || url}"` },
          { status: 400 }
        );
      }
      cleaned.push({
        id,
        name,
        url,
        category: String(raw?.category || "general").trim(),
        ...(raw?.fallbackUrl ? { fallbackUrl: String(raw.fallbackUrl).trim() } : {}),
        ...(raw?.wildcard ? { wildcard: true } : {}),
      });
    }

    await runMigrations();
    await writeState(STATE.sources, cleaned);
    return NextResponse.json({ ok: true, count: cleaned.length });
  } catch (error) {
    console.error("Sources write error:", error);
    return NextResponse.json({ error: "Failed to save sources" }, { status: 500 });
  }
}
