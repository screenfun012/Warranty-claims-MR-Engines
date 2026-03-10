/**
 * Serve a file from sent mail archive on NAS (for viewing body and attachments).
 * GET /api/mail-archive/content?path=Poslati_mailovi/Subject/body.html
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession } from "@/lib/auth/get-session";
import { readSentMailFile } from "@/lib/files/fileStorage";
import { requireMinimumRole, createPermissionError, ROLES } from "@/lib/auth/permissions";

const MIME: Record<string, string> = {
  ".json": "application/json",
  ".html": "text/html; charset=utf-8",
  ".htm": "text/html; charset=utf-8",
  ".txt": "text/plain; charset=utf-8",
  ".pdf": "application/pdf",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".gif": "image/gif",
  ".webp": "image/webp",
};

export async function GET(request: NextRequest) {
  try {
    await requireMinimumRole(ROLES.ADMIN);
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

  const buf = await readSentMailFile(pathParam.trim());
  if (!buf) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = pathParam.includes(".") ? pathParam.slice(pathParam.lastIndexOf(".")) : "";
  const contentType = MIME[ext.toLowerCase()] ?? "application/octet-stream";

  return new NextResponse(new Uint8Array(buf), {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "private, max-age=60",
    },
  });
}
