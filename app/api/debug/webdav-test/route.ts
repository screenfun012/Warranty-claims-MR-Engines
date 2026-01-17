/**
 * Debug endpoint to test WebDAV connection
 * GET /api/debug/webdav-test
 */

import { NextResponse } from "next/server";
import { env } from "@/lib/config/env";
import { createClient } from "webdav";
import https from "https";

export async function GET() {
  try {
    const hasWebDAVUrl = !!env.WEBDAV_URL;
    const hasWebDAVUsername = !!env.WEBDAV_USERNAME;
    const hasWebDAVPassword = !!env.WEBDAV_PASSWORD;
    const useWebDAV = hasWebDAVUrl && hasWebDAVUsername && hasWebDAVPassword;

    if (!useWebDAV) {
      return NextResponse.json({
        success: false,
        error: "WebDAV not configured. Missing URL, username, or password.",
      });
    }

    console.log(`[WebDAV Test] Testing connection to: ${env.WEBDAV_URL}`);
    console.log(`[WebDAV Test] Base path: ${env.WEBDAV_BASE_PATH}`);

    // Create HTTPS agent that accepts self-signed certificates
    // This is needed when connecting through Nginx proxy with self-signed cert
    const httpsAgent = new https.Agent({
      rejectUnauthorized: false, // Accept self-signed certificate from proxy
    });

    // Create WebDAV client
    const webdavClient = createClient(env.WEBDAV_URL, {
      username: env.WEBDAV_USERNAME,
      password: env.WEBDAV_PASSWORD,
      httpsAgent: httpsAgent, // Use custom HTTPS agent
    });

    // Test connection by listing directory
    const basePath = env.WEBDAV_BASE_PATH;
    console.log(`[WebDAV Test] Checking if base path exists: ${basePath}`);

    try {
      const exists = await webdavClient.exists(basePath);
      console.log(`[WebDAV Test] Base path exists: ${exists}`);

      if (!exists) {
        // Try to create directory
        console.log(`[WebDAV Test] Creating base directory: ${basePath}`);
        await webdavClient.createDirectory(basePath, { recursive: true });
        console.log(`[WebDAV Test] Base directory created successfully`);
      }

      // List contents of base path
      const contents = await webdavClient.getDirectoryContents(basePath);
      const contentsArray = Array.isArray(contents) ? contents : (contents.data || []);
      console.log(`[WebDAV Test] Directory contents: ${contentsArray.length} items`);

      // Test write by creating a test file
      const testPath = `${basePath}/.test-connection`;
      const testContent = Buffer.from(`Test file created at ${new Date().toISOString()}`);
      
      console.log(`[WebDAV Test] Creating test file: ${testPath}`);
      await webdavClient.putFileContents(testPath, testContent, {
        overwrite: true,
      });
      console.log(`[WebDAV Test] Test file created successfully`);

      // Try to read it back
      const readContent = await webdavClient.getFileContents(testPath, { format: 'binary' });
      const readBuffer = Buffer.from(readContent as ArrayBuffer);
      console.log(`[WebDAV Test] Test file read back: ${readBuffer.length} bytes`);

      // Delete test file
      await webdavClient.deleteFile(testPath);
      console.log(`[WebDAV Test] Test file deleted`);

      return NextResponse.json({
        success: true,
        message: "WebDAV connection successful!",
        details: {
          url: env.WEBDAV_URL,
          basePath: basePath,
          basePathExists: exists,
          directoryContents: contentsArray.length,
          testWriteRead: "successful",
        },
      });
    } catch (error) {
      console.error(`[WebDAV Test] Error:`, error);
      return NextResponse.json({
        success: false,
        error: error instanceof Error ? error.message : String(error),
        details: {
          url: env.WEBDAV_URL,
          basePath: basePath,
          errorType: error instanceof Error ? error.constructor.name : typeof error,
        },
      }, { status: 500 });
    }
  } catch (error) {
    console.error("Error testing WebDAV connection:", error);
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 }
    );
  }
}
