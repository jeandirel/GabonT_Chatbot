import { SignJWT, jwtVerify } from "jose";
import { createHash, randomBytes } from "node:crypto";
import { db } from "./db";

const encoder = new TextEncoder();
function secret() {
  const value = process.env.SESSION_SECRET;
  if (!value || value.length < 32) throw new Error("SESSION_SECRET doit contenir au moins 32 caractères.");
  return encoder.encode(value);
}

export async function createSessionToken(userId: string) {
  return new SignJWT({ sub: userId, scope: "customer" }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("15m").setIssuer("moov-assist").setAudience("moov-money").sign(secret());
}

export async function verifySessionToken(token: string) {
  const result = await jwtVerify(token, secret(), { issuer: "moov-assist", audience: "moov-money" });
  return result.payload.sub;
}

function hashRefreshToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

export async function createRefreshToken(userId: string) {
  const token = randomBytes(48).toString("base64url");
  await db().refreshToken.create({ data: { userId, tokenHash: hashRefreshToken(token), expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60_000) } });
  return token;
}

export async function rotateRefreshToken(token: string) {
  const record = await db().refreshToken.findUnique({ where: { tokenHash: hashRefreshToken(token) } });
  if (!record || record.revokedAt || record.expiresAt <= new Date()) throw new Error("Jeton de renouvellement invalide ou expiré.");
  await db().refreshToken.update({ where: { id: record.id }, data: { revokedAt: new Date(), lastUsedAt: new Date() } });
  return { userId: record.userId, refreshToken: await createRefreshToken(record.userId), accessToken: await createSessionToken(record.userId) };
}

export async function revokeRefreshToken(token: string) {
  return db().refreshToken.updateMany({ where: { tokenHash: hashRefreshToken(token), revokedAt: null }, data: { revokedAt: new Date() } });
}

export async function createConfirmationToken(userId: string, context: Record<string, unknown>) {
  return new SignJWT({ sub: userId, scope: "transaction:confirm", context }).setProtectedHeader({ alg: "HS256" }).setIssuedAt().setExpirationTime("2m").setIssuer("moov-assist").setAudience("moov-money-transaction").sign(secret());
}

export async function verifyConfirmationToken(token: string) {
  const result = await jwtVerify(token, secret(), { issuer: "moov-assist", audience: "moov-money-transaction" });
  if (result.payload.scope !== "transaction:confirm" || !result.payload.sub) throw new Error("Confirmation forte invalide.");
  return { userId: result.payload.sub, context: result.payload.context as Record<string, unknown> | undefined };
}

export const sessionCookie = { name: "moov_session", options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/", maxAge: 900 } };
export const refreshCookie = { name: "moov_refresh", options: { httpOnly: true, secure: process.env.NODE_ENV === "production", sameSite: "strict" as const, path: "/api/auth", maxAge: 30 * 24 * 60 * 60 } };
