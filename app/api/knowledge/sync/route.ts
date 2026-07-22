import { NextResponse } from "next/server";
import { moovApiBase } from "../../../../lib/server/moov-api";

/** Déclenche l’indexation site Moov + réseaux via FastAPI. */
export async function POST() {
  try {
    const res = await fetch(`${moovApiBase()}/api/knowledge/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      cache: "no-store",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      return NextResponse.json(
        { error: data.detail || data.error || "Sync knowledge échouée" },
        { status: res.status },
      );
    }
    return NextResponse.json(data);
  } catch {
    return NextResponse.json(
      { error: "API Moov indisponible (MOOV_API_URL)." },
      { status: 502 },
    );
  }
}
