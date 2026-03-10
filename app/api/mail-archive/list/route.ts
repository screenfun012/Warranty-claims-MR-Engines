/**
 * List files in one sent mail folder (for attachments etc).
 * GET /api/mail-archive/list?path=Poslati_mailovi/Subject
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { listSentMailFolderFiles } from "@/lib/files/fileStorage";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
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

  const pathParam = request.nextUrl.searchParams.get("path");
  if (!pathParam?.trim()) {
    return NextResponse.json({ error: "path is required" }, { status: 400 });
  }

  const files = await listSentMailFolderFiles(pathParam.trim());
  return NextResponse.json({ files });
}
