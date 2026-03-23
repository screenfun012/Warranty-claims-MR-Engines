import { NextResponse } from "next/server";

/** Brza provera da je APP_URL tačan (GET bez auth-a). */
export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    ok: true,
    service: "mr-engines-warranty",
    time: new Date().toISOString(),
  });
}
