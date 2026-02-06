/**
 * Create an in-app notification for a user.
 * Call this when e.g. a user is assigned to a planner item or claim.
 */
import { getPrisma } from "@/lib/db/prisma";

export type NotificationType =
  | "PLANNER_ASSIGNED"
  | "PLANNER_ITEM_ASSIGNED"
  | "CLAIM_ASSIGNED"
  | "SYSTEM";

export async function createNotification(
  userId: string,
  opts: {
    type: NotificationType;
    title: string;
    body?: string | null;
    link?: string | null;
  }
): Promise<void> {
  try {
    const prisma = await getPrisma();
    await prisma.notification.create({
      data: {
        userId,
        type: opts.type,
        title: opts.title,
        body: opts.body ?? null,
        link: opts.link ?? null,
      },
    });
  } catch (err) {
    console.warn("[createNotification] Failed:", err);
  }
}
