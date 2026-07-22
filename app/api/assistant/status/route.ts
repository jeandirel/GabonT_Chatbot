import { NextResponse } from "next/server";
import { moovApiBase } from "../../../../lib/server/moov-api";

/** Santé FastAPI + URL WebSocket Live pour le client navigateur. */
export async function GET() {
  const base = moovApiBase();
  const wsOrigin = base.replace(/^http/, "ws");
  try {
    const res = await fetch(`${base}/api/health`, { cache: "no-store" });
    const data = (await res.json().catch(() => ({}))) as Record<string, unknown>;
    if (!res.ok) {
      return NextResponse.json(
        {
          online: false,
          voice_mode: "turn",
          ws_url: `${wsOrigin}/ws/live`,
          error: data.detail || data.error || `HTTP ${res.status}`,
        },
        { status: 502 },
      );
    }
    return NextResponse.json({
      online: true,
      voice_mode: data.voice_mode === "live" ? "live" : "turn",
      live_ws: data.live_ws || "/ws/live",
      api_url: base,
      ws_url: `${wsOrigin}/ws/live`,
      live_model: data.live_model,
      llm_providers: data.llm_providers,
      service: data.service,
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "API indisponible";
    return NextResponse.json(
      {
        online: false,
        voice_mode: "turn",
        ws_url: `${wsOrigin}/ws/live`,
        error: message,
      },
      { status: 502 },
    );
  }
}
