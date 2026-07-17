import { NextRequest, NextResponse } from "next/server";
import { getBalance } from "../../../../lib/server/moov-money";

export async function GET(request: NextRequest) {
  const customerId = request.nextUrl.searchParams.get("customerId") || "demo-user";
  return NextResponse.json(await getBalance(customerId));
}
