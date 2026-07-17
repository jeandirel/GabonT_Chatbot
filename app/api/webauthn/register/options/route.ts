import { NextRequest, NextResponse } from "next/server";
import { registrationOptions } from "../../../../../lib/server/webauthn";
import { authenticatedUser, authenticationStatus } from "../../../../../lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const user = await authenticatedUser(request, String(body.phone || ""));
    const phone = user.phone.replace(/\s/g, "");
    if (!/^0[1-7]\d{7}$/.test(phone)) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });
    return NextResponse.json(await registrationOptions(phone, body.displayName));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur WebAuthn" }, { status: authenticationStatus(error) === 401 ? 401 : 400 }); }
}
