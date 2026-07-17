import { NextRequest, NextResponse } from "next/server";
import { authenticationOptions } from "../../../../../lib/server/webauthn";
import { authenticatedUser, authenticationStatus } from "../../../../../lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let phone = String(body.phone || "").replace(/\s/g, "");
    if (body.context) {
      const allowed = new Set(["transfer", "airtime", "bill"]);
      if (!allowed.has(body.context.type) || !Number.isFinite(Number(body.context.amount)) || Number(body.context.amount) <= 0) return NextResponse.json({ error: "Contexte de transaction invalide" }, { status: 400 });
      phone = (await authenticatedUser(request, phone)).phone;
    }
    if (!/^0[1-7]\d{7}$/.test(phone)) return NextResponse.json({ error: "Numéro invalide" }, { status: 400 });
    return NextResponse.json(await authenticationOptions(phone, body.context));
  }
  catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Erreur WebAuthn" }, { status: authenticationStatus(error) === 401 ? 401 : 400 }); }
}
