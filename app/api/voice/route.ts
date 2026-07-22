import { NextRequest, NextResponse } from "next/server";
import { IntegrationError } from "../../../lib/server/http";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";
import { moovApiVoiceTurn } from "../../../lib/server/moov-api";

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`voice:${clientKey(request)}`, 20, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Trop de requêtes vocales. Réessayez dans un instant." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }

    const incoming = await request.formData();
    const file = incoming.get("file");
    if (!(file instanceof Blob) || file.size === 0) {
      return NextResponse.json({ error: "Audio manquant" }, { status: 400 });
    }

    const form = new FormData();
    form.append("file", file, (file as File).name || "audio.webm");
    form.append("language", String(incoming.get("language") || "fr"));
    if (incoming.get("conversationId")) {
      form.append("conversationId", String(incoming.get("conversationId")));
    }
    form.append("includeAudio", String(incoming.get("includeAudio") ?? "true"));

    const result = await moovApiVoiceTurn(form);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof IntegrationError ? error.status : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "API voice Moov Assist indisponible. Lancez ./scripts/run_api.sh",
      },
      { status },
    );
  }
}
