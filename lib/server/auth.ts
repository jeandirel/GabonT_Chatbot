import type { NextRequest } from "next/server";
import { db, hasDatabase } from "./db";
import { sessionCookie, verifySessionToken } from "./session";

export class AuthenticationError extends Error {}

export type AuthenticatedUser = { id: string; phone: string };

export async function authenticatedUser(request: NextRequest, developmentPhone?: string): Promise<AuthenticatedUser> {
  const authorization = request.headers.get("authorization");
  const bearer = authorization?.startsWith("Bearer ") ? authorization.slice(7).trim() : undefined;
  const token = bearer || request.cookies.get(sessionCookie.name)?.value;
  if (token) {
    try {
      const userId = await verifySessionToken(token);
      if (userId && hasDatabase()) {
        const user = await db().user.findUnique({ where: { id: userId }, select: { id: true, phone: true } });
        if (user) return user;
      }
    } catch {
      // A malformed or expired cookie is handled as an unauthenticated request.
    }
  }

  if (process.env.NODE_ENV !== "production" && developmentPhone) {
    const phone = developmentPhone.replace(/\s/g, "");
    if (hasDatabase()) {
      return db().user.upsert({ where: { phone }, update: {}, create: { phone }, select: { id: true, phone: true } });
    }
    return { id: phone, phone };
  }
  throw new AuthenticationError("Session expirée ou absente.");
}

export function authenticationStatus(error: unknown) {
  return error instanceof AuthenticationError ? 401 : 500;
}
