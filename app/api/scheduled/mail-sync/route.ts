/**
 * Isti handler kao /api/cron/mail-sync — koristi ako treba druga putanja.
 */
import { handleMailSyncCronGet } from "@/lib/email/mailSyncCronRoute";

export const runtime = "nodejs";
export const maxDuration = 300;
export const dynamic = "force-dynamic";

export async function GET(request: Request) {
  return handleMailSyncCronGet(request);
}
