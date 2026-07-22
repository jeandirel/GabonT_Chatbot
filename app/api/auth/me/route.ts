import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, AuthenticationError } from "../../../../lib/server/auth";
import { PROVISIONAL_USERS } from "../../../../lib/provisional-users";

export async function GET(request: NextRequest) {
  try {
    const user = await authenticatedUser(request);
    const provisional = Object.values(PROVISIONAL_USERS).find((u) => u.id === user.id);
    return NextResponse.json(
      {
        authenticated: true,
        user: provisional
          ? {
              id: provisional.id,
              displayName: provisional.displayName,
              phone: provisional.phone,
              phoneE164: provisional.phoneE164,
              locale: provisional.locale,
              initials: provisional.initials,
            }
          : {
              id: user.id,
              displayName: user.phone,
              phone: user.phone,
              initials: "MA",
              locale: "fr",
            },
      },
      { headers: { "Cache-Control": "no-store" } },
    );
  } catch (error) {
    if (error instanceof AuthenticationError) {
      return NextResponse.json({ authenticated: false }, { status: 401 });
    }
    return NextResponse.json({ authenticated: false, error: "Session invalide" }, { status: 401 });
  }
}
