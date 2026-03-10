/**
 * List sent mail folders (from NAS Poslati_mailovi).
 * GET /api/mail-archive
 */

import { NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { listSentMailFolders } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET() {
  try {
    await requirePermission(PERMISSIONS.CLAIMS_READ);
  } catch (error) {
    const permError = createPermissionError(error);
    if (permError.status !== 500) {
      return NextResponse.json({ error: permError.message }, { status: permError.status });
    }
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const session = await getSession();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const folders = await listSentMailFolders();
    return NextResponse.json({ folders });
  } catch (err) {
    console.error("[mail-archive] List error:", err);
    return NextResponse.json({ error: "Failed to list archive" }, { status: 500 });
  }
}
