import { NextRequest, NextResponse } from "next/server";
import { verifyAuthentication } from "../../../../../lib/server/webauthn";
import { createConfirmationToken, createRefreshToken, createSessionToken, refreshCookie, sessionCookie } from "../../../../../lib/server/session";
import { authenticatedUser, authenticationStatus } from "../../../../../lib/server/auth";

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    let phone = String(body.phone || "").replace(/\s/g, "");
    if (!phone) phone = (await authenticatedUser(request)).phone;
    const result = await verifyAuthentication(phone, body.response);
    const confirmationToken = result.context ? await createConfirmationToken(result.userId, result.context) : undefined;
    const accessToken = confirmationToken ? undefined : await createSessionToken(result.userId);
    const refreshToken = confirmationToken ? undefined : await createRefreshToken(result.userId);
    const mobile = request.headers.get("x-client-type") === "mobile";
    const response = NextResponse.json({ verified: true, confirmationToken, expiresIn: accessToken ? 900 : undefined, ...(mobile && accessToken && refreshToken ? { accessToken, refreshToken } : {}) });
    if (accessToken && refreshToken) {
      response.cookies.set(sessionCookie.name, accessToken, sessionCookie.options);
      response.cookies.set(refreshCookie.name, refreshToken, refreshCookie.options);
    }
    return response;
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Échec de vérification" }, { status: authenticationStatus(error) === 401 ? 401 : 400 }); }
}
