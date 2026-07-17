import { NextRequest, NextResponse } from "next/server";
import { chat } from "../../../lib/server/chatbase";
import { IntegrationError } from "../../../lib/server/http";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const message = typeof body.message === "string" ? body.message.trim() : "";
    if (!message || message.length > 4000) return NextResponse.json({ error: "Message invalide" }, { status: 400 });
    const userId = String(body.userId || "demo-user").replace(/[^a-zA-Z0-9._-]/g, "-").slice(0,128);
    const result = await chat(message, userId, body.conversationId);
    return NextResponse.json(result, { headers: { "Cache-Control": "no-store" } });
  } catch (error) {
    const status = error instanceof IntegrationError ? error.status : 500;
    return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur interne", requestId: error instanceof IntegrationError ? error.requestId : undefined }, { status });
  }
}
