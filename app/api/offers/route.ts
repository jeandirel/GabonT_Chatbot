import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { getPersonalizedOffers } from "../../../lib/server/crm";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request, request.nextUrl.searchParams.get("customerId") || "demo-user");
    return NextResponse.json(await getPersonalizedOffers(user.phone));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Offres indisponibles" }, { status: authenticationStatus(error) }); }
}
