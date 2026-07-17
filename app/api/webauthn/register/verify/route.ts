import { NextRequest, NextResponse } from "next/server";
import { verifyRegistration } from "../../../../../lib/server/webauthn";
import { authenticatedUser, authenticationStatus } from "../../../../../lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await authenticatedUser(request, String(body.phone || ""));
    return NextResponse.json(await verifyRegistration(user.phone, body.response));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Échec de vérification" }, { status: authenticationStatus(error) === 401 ? 401 : 400 }); }
}
