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
export const maxDuration = 60;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMailSyncCronGet(request);
}
