import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { financialInsights } from "../../../lib/server/insights";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    return NextResponse.json(await financialInsights(user.id));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Analyse indisponible" }, { status: authenticationStatus(error) }); }
}
