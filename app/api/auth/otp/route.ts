import { NextRequest, NextResponse } from "next/server";

export async function POST(request: NextRequest) {
  const body = await request.json();
  const phone = String(body.phone || "").replace(/\s/g, "");
  if (!/^0[1-7]\d{7}$/.test(phone)) return NextResponse.json({ error: "Numéro gabonais invalide" }, { status: 400 });
  if (body.code) return NextResponse.json({ verified: process.env.NODE_ENV !== "production" && body.code === "123456", verificationToken: body.code === "123456" ? crypto.randomUUID() : undefined });
  return NextResponse.json({ challengeId: crypto.randomUUID(), expiresIn: 300, mock: true }, { status: 201 });
}
