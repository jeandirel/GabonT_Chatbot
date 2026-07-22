import { NextRequest, NextResponse } from "next/server";
import { clientKey, rateLimit } from "../../../../lib/server/rate-limit";
import { createHmac, randomInt, timingSafeEqual } from "node:crypto";
import { db, hasDatabase } from "../../../../lib/server/db";
import { sendOtp } from "../../../../lib/server/sms";
import { createRefreshToken, createSessionToken, refreshCookie, sessionCookie } from "../../../../lib/server/session";
import { DEMO_OTP, lookupProvisional, normalizeGabonPhone } from "../../../../lib/provisional-users";

function hash(code: string) {
  const secret = process.env.OTP_SECRET || process.env.SESSION_SECRET || "development-only-secret-moov-assist-32chars!";
  return createHmac("sha256", secret).update(code).digest("hex");
}

async function provisionalSession(userId: string, request: NextRequest, extra: Record<string, unknown>) {
  // SESSION_SECRET optionnel en démo : injecter une valeur de développement
  if (!process.env.SESSION_SECRET || process.env.SESSION_SECRET.length < 32) {
    process.env.SESSION_SECRET = "development-only-secret-moov-assist-32chars!";
  }
  const accessToken = await createSessionToken(userId);
  const mobile = request.headers.get("x-client-type") === "mobile";
  const response = NextResponse.json({
    verified: true,
    provisional: true,
    expiresIn: 900,
    ...extra,
    ...(mobile ? { accessToken } : {}),
  });
  response.cookies.set(sessionCookie.name, accessToken, sessionCookie.options);
  return response;
}

export async function POST(request: NextRequest) {
  const limit = rateLimit(`otp:${clientKey(request)}`, 5, 10 * 60_000);
  if (!limit.allowed) {
    return NextResponse.json({ error: "Trop de tentatives OTP." }, { status: 429, headers: { "Retry-After": String(limit.retryAfter) } });
  }
  const body = await request.json();
  const phone = normalizeGabonPhone(String(body.phone || ""));
  const provisional = lookupProvisional(phone);

  // Format local POC : 0 + indicatif 1–7 + 6 ou 7 chiffres (ex. 06123456)
  if (!/^0[1-7]\d{6,7}$/.test(phone)) {
    return NextResponse.json({ error: "Numéro gabonais invalide" }, { status: 400 });
  }

  // ——— Vérification code ———
  if (body.code) {
    if (provisional) {
      if (String(body.code).trim() !== DEMO_OTP) {
        return NextResponse.json({ error: "Code invalide (démo : 123456)", verified: false }, { status: 400 });
      }
      return provisionalSession(provisional.id, request, {
        user: provisional,
        hint: `Connecté en tant que ${provisional.displayName}`,
      });
    }

    if (!hasDatabase()) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json({ error: "Service d’authentification non configuré" }, { status: 503 });
      }
      return NextResponse.json({
        verified: false,
        error:
          "Sur ce POC, utilisez +241 06123456 (Jean Direl), +241 06123457 (Christian BEYEME) ou +241 06123458 (Xavier Ondo).",
      }, { status: 403 });
    }

    const challenge = await db().otpChallenge.findFirst({
      where: { phone, verifiedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: "desc" },
    });
    if (!challenge || challenge.attempts >= 5) {
      return NextResponse.json({ error: "Code expiré ou trop de tentatives" }, { status: 400 });
    }
    const actual = Buffer.from(hash(String(body.code)));
    const expected = Buffer.from(challenge.codeHash);
    const verified = actual.length === expected.length && timingSafeEqual(actual, expected);
    await db().otpChallenge.update({
      where: { id: challenge.id },
      data: verified ? { verifiedAt: new Date() } : { attempts: { increment: 1 } },
    });
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

  // ——— Envoi OTP ———
  if (!provisional && !hasDatabase()) {
    return NextResponse.json(
      {
        error:
          "Numéro non autorisé sur ce POC. Comptes provisoires : +241 06123456 (Jean Direl), +241 06123457 (Christian BEYEME), +241 06123458 (Xavier Ondo).",
      },
      { status: 403 },
    );
  }

  const code = provisional || process.env.NODE_ENV !== "production" ? DEMO_OTP : String(randomInt(100000, 1000000));
  if (process.env.NODE_ENV === "production" && !hasDatabase() && !provisional) {
    return NextResponse.json({ error: "Service d’authentification non configuré" }, { status: 503 });
  }

  let challengeId = crypto.randomUUID();
  if (hasDatabase() && !provisional) {
    const challenge = await db().otpChallenge.create({
      data: { phone, codeHash: hash(code), expiresAt: new Date(Date.now() + 5 * 60_000) },
    });
    challengeId = challenge.id;
  }

  const delivery = provisional
    ? { mock: true }
    : await sendOtp(phone, code);

  return NextResponse.json(
    {
      challengeId,
      expiresIn: 300,
      mock: "mock" in delivery ? delivery.mock : true,
      ...(provisional
        ? {
            provisional: true,
            userPreview: provisional.displayName,
            hint: `Code démo pour ${provisional.displayName} : ${DEMO_OTP}`,
          }
        : {}),
    },
    { status: 201 },
  );
}
