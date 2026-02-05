/**
 * GET - Šalje email podsetnik korisnicima koji imaju dodeljene stavke (kasne ili sve).
 * Zaštićeno: ?secret=CRON_SECRET (ili PLANNER_REMINDER_SECRET)
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { sendEmail } from "@/lib/email/smtpClient";

const todayStart = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export async function GET(request: NextRequest) {
  const secret = request.nextUrl.searchParams.get("secret");
  const expected = process.env.CRON_SECRET || process.env.PLANNER_REMINDER_SECRET;
  if (!expected || secret !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const prisma = await getPrisma();
    const assignedUserIds = await prisma.exportBatchItem.findMany({
      where: { assignedToId: { not: null } },
      distinct: ["assignedToId"],
      select: { assignedToId: true },
    });
    const userIds = assignedUserIds.map((r) => r.assignedToId).filter(Boolean) as string[];
    if (userIds.length === 0) {
      return NextResponse.json({ sent: 0, message: "No users with assignments" });
    }

    const users = await prisma.user.findMany({
      where: { id: { in: userIds } },
      select: { id: true, email: true, fullName: true },
    });

    const items = await prisma.exportBatchItem.findMany({
      where: { assignedToId: { in: userIds } },
      select: { assignedToId: true, dueDate: true },
    });

    const now = todayStart();
    let sent = 0;
    for (const user of users) {
      const userItems = items.filter((i) => i.assignedToId === user.id);
      const lateCount = userItems.filter((i) => {
        if (!i.dueDate) return false;
        const due = new Date(i.dueDate);
        due.setHours(0, 0, 0, 0);
        return due < now;
      }).length;
      const assignedCount = userItems.length;
      if (assignedCount === 0) continue;
      const email = user.email;
      if (!email) continue;

      const name = user.fullName || "Korisniče";
      const subject = lateCount > 0
        ? `Planer: ${lateCount} kasnih stavki, ukupno ${assignedCount} dodeljeno`
        : `Planer: ${assignedCount} dodeljenih stavki`;
      const text = lateCount > 0
        ? `Zdravo ${name},\n\nImaš ${lateCount} kasnih stavki i ukupno ${assignedCount} dodeljenih stavki u planeru izvoza.\n\nPregledaj ih u aplikaciji: Pregled → Stavke dodeljene meni / Kasne stavke.`
        : `Zdravo ${name},\n\nImaš ${assignedCount} dodeljenih stavki u planeru izvoza.\n\nPregledaj u aplikaciji: Pregled.`;

      try {
        await sendEmail({ to: email, subject, text });
        sent++;
      } catch (e) {
        console.warn("[planner-reminders] Failed to send to", email, e);
      }
    }

    return NextResponse.json({ sent, total: users.length });
  } catch (e) {
    console.error("[planner-reminders]", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
