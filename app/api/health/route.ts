import { NextResponse } from "next/server";

export function GET() {
  return NextResponse.json({ status: "ok", timestamp: new Date().toISOString(), integrations: { chatbase: Boolean(process.env.CHATBASE_API_KEY && process.env.CHATBASE_AGENT_ID), moovMoney: Boolean(process.env.MOOV_MONEY_API_URL), ticketing: Boolean(process.env.TICKETING_API_URL) } });
}
