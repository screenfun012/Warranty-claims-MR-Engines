/**
 * Debug endpoint to check storage configuration
 * GET /api/debug/storage
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";

export async function GET() {
  try {
    const hasWebDAVUrl = !!env.WEBDAV_URL;
    const hasWebDAVUsername = !!env.WEBDAV_USERNAME;
    const hasWebDAVPassword = !!env.WEBDAV_PASSWORD;
    const useWebDAV = hasWebDAVUrl && hasWebDAVUsername && hasWebDAVPassword;
    
    const hasBlobToken = !!env.BLOB_READ_WRITE_TOKEN;
    
    return NextResponse.json({
      storage: {
        type: useWebDAV ? "WebDAV" : hasBlobToken ? "Vercel Blob" : "Filesystem",
        configured: useWebDAV || hasBlobToken,
      },
      webdav: {
        enabled: useWebDAV,
        url: hasWebDAVUrl ? `${env.WEBDAV_URL.substring(0, 30)}...` : "not set",
        username: hasWebDAVUsername ? "***" : "not set",
        password: hasWebDAVPassword ? "***" : "not set",
        basePath: env.WEBDAV_BASE_PATH,
      },
      blob: {
        enabled: hasBlobToken && !useWebDAV,
        token: hasBlobToken ? "***" : "not set",
      },
      filesystem: {
        enabled: !useWebDAV && !hasBlobToken,
        path: env.FILE_ROOT_PATH,
        warning: "Filesystem storage does not persist on Vercel serverless functions!",
      },
    });
  } catch (error) {
    console.error("Error checking storage configuration:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error" },
      { status: 500 }
    );
  }
}
