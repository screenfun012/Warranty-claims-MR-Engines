/**
 * Debug endpoint to check storage configuration
 * GET /api/debug/storage
 * Storage: Synology (WebDAV) only. Fallback: local filesystem for dev.
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";

export async function GET() {
  try {
    const hasWebDAVUrl = !!env.WEBDAV_URL;
    const hasWebDAVUsername = !!env.WEBDAV_USERNAME;
    const hasWebDAVPassword = !!env.WEBDAV_PASSWORD;
    const useWebDAV = hasWebDAVUrl && hasWebDAVUsername && hasWebDAVPassword;

    return NextResponse.json({
      storage: {
        type: useWebDAV ? "WebDAV (Synology NAS)" : "Filesystem (dev only)",
        configured: useWebDAV,
      },
      webdav: {
        enabled: useWebDAV,
        url: hasWebDAVUrl ? `${env.WEBDAV_URL.substring(0, 30)}...` : "not set",
        username: hasWebDAVUsername ? "***" : "not set",
        password: hasWebDAVPassword ? "***" : "not set",
        basePath: env.WEBDAV_BASE_PATH,
      },
      filesystem: {
        enabled: !useWebDAV,
        path: env.FILE_ROOT_PATH,
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
