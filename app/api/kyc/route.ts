import { NextRequest, NextResponse } from "next/server";
import { submitKyc } from "../../../lib/server/kyc";

export async function POST(request: NextRequest) {
  const body = await request.json();
  if (!body.documentType || !body.identityFileName || !body.addressFileName) return NextResponse.json({ error: "Dossier KYC incomplet" }, { status: 400 });
  return NextResponse.json(await submitKyc({ customerId: body.customerId || "demo-user", documentType: body.documentType, identityFileName: body.identityFileName, addressFileName: body.addressFileName }), { status: 202 });
}
