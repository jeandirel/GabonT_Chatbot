import { NextRequest, NextResponse } from "next/server";
import { chat } from "../../../lib/server/chatbase";
import { IntegrationError } from "../../../lib/server/http";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";
import { authenticatedUser } from "../../../lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`chat:${clientKey(request)}`, 30, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Trop de messages. Réessayez dans un instant." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4000) return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    const user = await authenticatedUser(request).catch(() => undefined);
    const anonymousId = `anonymous-${clientKey(request).replace(/[^a-zA-Z0-9._-]/g, "-").slice(0,96)}`;
    const result = await chat(message, user?.id || anonymousId, body.conversationId, user?.phone);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof IntegrationError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne", requestId: error instanceof IntegrationError ? error.requestId : undefined }, { status });
  }
}
