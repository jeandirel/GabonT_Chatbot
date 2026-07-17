import { NextRequest, NextResponse } from "next/server";
import { authenticatedUser, authenticationStatus } from "../../../lib/server/auth";
import { DiagnosticKind, runDiagnostic } from "../../../lib/server/diagnostics";
import { clientKey, rateLimit } from "../../../lib/server/rate-limit";

const allowed = new Set<DiagnosticKind>(["PIN_LOCKED", "SIM_ISSUE", "TRANSFER_PENDING", "BALANCE_MISMATCH"]);

export async function POST(request: NextRequest) {
  try {
    const limit = rateLimit(`diagnostic:${clientKey(request)}`, 10, 60_000);
    if (!limit.allowed) return NextResponse.json({ error: "Trop de diagnostics successifs." }, { status: 429 });
    const body = await request.json();
    if (!allowed.has(body.kind)) return NextResponse.json({ error: "Type de diagnostic invalide" }, { status: 400 });
    const user = await authenticatedUser(request, body.customerId || "demo-user");
    return NextResponse.json(await runDiagnostic(user.phone, body.kind, body.reference));
  } catch (error) { return NextResponse.json({ error: error instanceof Error ? error.message : "Diagnostic indisponible" }, { status: authenticationStatus(error) }); }
}
