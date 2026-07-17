import { NextRequest, NextResponse } from "next/server";
import { refreshCookie, rotateRefreshToken, sessionCookie } from "../../../../lib/server/session";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const supplied = request.cookies.get(refreshCookie.name)?.value || body.refreshToken;
    if (!supplied) return NextResponse.json({ error: "Jeton de renouvellement manquant" }, { status: 401 });
    const tokens = await rotateRefreshToken(String(supplied));
    const mobile = request.headers.get("x-client-type") === "mobile";
    const response = NextResponse.json({ expiresIn: 900, ...(mobile ? { accessToken: tokens.accessToken, refreshToken: tokens.refreshToken } : {}) });
    response.cookies.set(sessionCookie.name, tokens.accessToken, sessionCookie.options);
    response.cookies.set(refreshCookie.name, tokens.refreshToken, refreshCookie.options);
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Renouvellement impossible" }, { status: 401 }); }
}
