/**
 * Periodični IMAP sync (GitHub Actions / curl sa CRON_SECRET).
 *
 * Ako ovaj URL na produkciji daje 404, proveri:
 * - APP_URL = tačan Production domen iz Vercela (bez / na kraju)
 * - Poslednji deploy sadrži ovu rutu (Deployments → Production)
 *
 * Alternativa: GET /api/scheduled/mail-sync (isti handler).
 */

import { handleMailSyncCronGet } from "@/lib/email/mailSyncCronRoute";

export const runtime = "nodejs";
/** Vercel Pro: do 300s; potrebno za IMAP + velike attachment-e (ranije 504 @ 60s). */
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMailSyncCronGet(request);
}
