import { NextRequest, NextResponse } from "next/server";
import { refreshCookie, revokeRefreshToken, sessionCookie } from "../../../../lib/server/session";

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => ({}));
  const supplied = request.cookies.get(refreshCookie.name)?.value || body.refreshToken;
  if (supplied) await revokeRefreshToken(String(supplied)).catch(() => undefined);
  const response = NextResponse.json({ loggedOut: true });
  response.cookies.set(sessionCookie.name, "", { ...sessionCookie.options, maxAge: 0 });
  response.cookies.set(refreshCookie.name, "", { ...refreshCookie.options, maxAge: 0 });
  return response;
}
