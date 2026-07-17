import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "../../../../lib/server/moov-money";
import { authenticatedUser, authenticationStatus } from "../../../../lib/server/auth";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    return NextResponse.json(await getBalance(user.phone));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Accès refusé" }, { status: authenticationStatus(error) }); }
}
