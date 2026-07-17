import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit } from "../../../../lib/server/rate-limit";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db, hasDatabase } from "../../../../lib/server/db";
import { sendOtp } from "../../../../lib/server/sms";
import { createRefreshToken, createSessionToken, refreshCookie, sessionCookie } from "../../../../lib/server/session";

function hash(code: string) {
  const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET || "development-only-secret";
  return createHmac("sha256", secret).update(code).digest("hex");
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`otp:${clientKey(request)}`, 5, 10 * 60_000);
  if (!limit.allowed) return NextResponse.json({ error: "Trop de tentatives OTP." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  const body = await request.json();
  const phone = String(body.phone || "").replace(/\s/g, "");
  if (!/^0[1-7]\d{7}$/.test(phone)) return NextResponse.json({ error: "Numéro gabonais invalide" }, { status: 400 });
  if (body.code) {
    if (!hasDatabase()) {
      if (process.env.NODE_ENV === "production") return NextResponse.json({ error: "Service d’authentification non configuré" }, { status: 503 });
      return NextResponse.json({ verified: body.code === "123456", mock: true });
    }
    const challenge = await db().otpChallenge.findFirst({ where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } }, orderBy: { createdAt: "desc" } });
    if (!challenge || challenge.attempts >= 5) return NextResponse.json({ error: "Code expiré ou trop de tentatives" }, { status: 400 });
    const actual = Buffer.from(hash(String(body.code))); const expected = Buffer.from(challenge.codeHash);
    const verified = actual.length === expected.length && timingSafeEqual(actual, expected);
    await db().otpChallenge.update({ where: { id: challenge.id }, data: verified ? { verifiedAt: new Date() } : { attempts: { increment: 1 } } });
    if (!verified) return NextResponse.json({ verified: false }, { status: 400 });
    const user = await db().user.upsert({ where: { phone }, update: {}, create: { phone } });
    const accessToken = await createSessionToken(user.id);
    const refreshToken = await createRefreshToken(user.id);
    const mobile = request.headers.get("x-client-type") === "mobile";
    const response = NextResponse.json({ verified: true, expiresIn: 900, ...(mobile ? { accessToken, refreshToken } : {}) });
    response.cookies.set(sessionCookie.name, accessToken, sessionCookie.options);
    response.cookies.set(refreshCookie.name, refreshToken, refreshCookie.options);
    return response;
  }
  const code = process.env.NODE_ENV === "production" ? String(randomInt(100000, 1000000)) : "123456";
  if (process.env.NODE_ENV === "production" && !hasDatabase()) return NextResponse.json({ error: "Service d’authentification non configuré" }, { status: 503 });
  let challengeId = crypto.randomUUID();
  if (hasDatabase()) {
    const challenge = await db().otpChallenge.create({ data: { phone, codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) } });
    challengeId = challenge.id;
  }
  const delivery = await sendOtp(phone, code);
  return NextResponse.json({ challengeId, expiresIn: 300, mock: "mock" in delivery ? delivery.mock : false }, { status: 201 });
}
