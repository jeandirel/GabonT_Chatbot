import { NextRequest, NextResponse } from "next/server";
import { IntegrationError } from "../../../lib/server/http";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";
import { authenticatedUser } from "../../../lib/server/auth";
import { moovApiChat } from "../../../lib/server/moov-api";
import { PROVISIONAL_USERS } from "../../../lib/provisional-users";

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`chat:${clientKey(request)}`, 30, 60_000);
    if (!limit.allowed) {
      return NextResponse.json(
        { error: "Trop de messages. Réessayez dans un instant." },
        { status: 429, headers: { "Retry-After": String(limit.retryAfter) } },
      );
    }
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4000) {
      return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    }

    const user = await authenticatedUser(request).catch(() => undefined);
    const provisional =
      user &&
      Object.values(PROVISIONAL_USERS).find((u) => u.id === user.id);

    const result = await moovApiChat({
      message,
      conversationId: body.conversationId,
      language: body.language || "fr",
      userId: user?.id || provisional?.id || body.userId,
      includeAudio: body.includeAudio !== false,
    });

    return NextResponse.json(
      {
        message: result.message,
        spoken: result.spoken || result.message,
        conversationId: result.conversationId,
        sources: result.sources,
        engine: result.engine || "langgraph-react",
        approved: result.approved,
        steps: result.steps,
        providers_used: result.providers_used,
        audio_base64: result.audio_base64 || "",
        audio_mime: result.audio_mime || "",
        tts_engine: result.tts_engine || "",
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    const status = error instanceof IntegrationError ? error.status : 502;
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "API FastAPI Moov Assist indisponible. Lancez : cd api && uvicorn app.main:app --port 8020",
        requestId: error instanceof IntegrationError ? error.requestId : undefined,
      },
      { status },
    );
  }
}
