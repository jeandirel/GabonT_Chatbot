import { NextRequest, NextResponse } from "next/server";
import { refreshCookie, revokeRefreshToken, sessionCookie } from "../../../../lib/server/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const supplied = request.cookies.get(refreshCookie.name)?.value || body.refreshToken;
  if (supplied) await revokeRefreshToken(String(supplied)).catch(() => undefined);
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(sessionCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 0,
    expires: new Date(0),
  });
  response.cookies.set(refreshCookie.name, "", {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "strict",
    path: "/api/auth",
    maxAge: 0,
    expires: new Date(0),
  });
  return response;
}
