import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";
import { ensureIdleStarted } from "@/lib/email/mailSyncScheduler";
import { countEffectivelyUnreadThreads } from "@/lib/inbox/effectiveUnread";

// Cache stats for 5 seconds to reduce database load but keep it responsive
let cachedStats: any = null;
let cacheTimestamp = 0;
const CACHE_DURATION = 5000; // 5 seconds

// Function to invalidate cache (internal use only)
function invalidateDashboardCache() {
  cachedStats = null;
  cacheTimestamp = 0;
}

export async function GET() {
  ensureIdleStarted();
  try {
    // VIEWER+ can view dashboard
    await requirePermission(PERMISSIONS.CLAIMS_READ);
  } catch (error) {
    const permError = createPermissionError(error);
    return NextResponse.json({ error: permError.message }, { status: permError.status });
  }

  // Return cached stats if still valid
  const now = Date.now();
  if (cachedStats && (now - cacheTimestamp) < CACHE_DURATION) {
    return NextResponse.json(cachedStats, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  }
  try {
    const prisma = await getPrisma();

    // ── One query for all status-derived counts ──────────────────────
    // total / approved / rejected / in-process / claimsByStatus all come
    // from a single groupBy instead of 5 separate round-trips to Turso.
    let claimsByStatusRaw: Array<{ status: string; _count: { id: number } }> = [];
    try {
      const groupResult = await prisma.claim.groupBy({
        by: ["status"],
        _count: { id: true },
      });
      claimsByStatusRaw = groupResult as unknown as Array<{ status: string; _count: { id: number } }>;
    } catch (groupByError) {
      console.warn("groupBy failed, using fallback:", groupByError);
      try {
        const allClaims = await prisma.claim.findMany({ select: { status: true } });
        const statusMap = new Map<string, number>();
        allClaims.forEach((c) => statusMap.set(c.status, (statusMap.get(c.status) || 0) + 1));
        claimsByStatusRaw = Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          _count: { id: count },
        }));
      } catch (error) {
        console.error("Error fetching claims by status:", error);
      }
    }
    const statusCount = (s: string) =>
      claimsByStatusRaw.find((r) => r.status === s)?._count.id ?? 0;
    const claimsByStatus = claimsByStatusRaw;
    const totalClaims = claimsByStatusRaw.reduce((a, r) => a + r._count.id, 0);
    const approvedCount = statusCount("APPROVED");
    const rejectedCount = statusCount("REJECTED");
    const inProcessCount = statusCount("NEW") + statusCount("IN_ANALYSIS");
    const resolvedCount = approvedCount + rejectedCount;

    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const twelveMonthsAgo = new Date();
    twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);

    // ── Remaining independent queries run in parallel (one round-trip wave) ──
    const [
      claimsByCustomerWithNames,
      recentClaims,
      unreadEmailsCount,
      allInAnalysis,
      monthClaims,
    ] = await Promise.all([
      // Claims by customer - grouped by company/name
      (async (): Promise<Array<{ customerId: string | null; customerName: string; count: number }>> => {
        try {
          const allClaimsWithCustomer = await prisma.claim.findMany({
            where: { customerId: { not: null } },
            select: {
              customerId: true,
              customer: { select: { id: true, name: true, company: true } },
            },
          });
          const customerGroupMap = new Map<string, { customerName: string; count: number; customerIds: string[] }>();
          allClaimsWithCustomer.forEach((claim) => {
            if (!claim.customer) return;
            const displayName = claim.customer.company?.trim() || claim.customer.name?.trim() || "Unknown";
            const normalizedKey = displayName.toLowerCase().trim();
            const existing = customerGroupMap.get(normalizedKey);
            if (existing) {
              existing.count++;
              if (!existing.customerIds.includes(claim.customer.id)) existing.customerIds.push(claim.customer.id);
            } else {
              customerGroupMap.set(normalizedKey, { customerName: displayName, count: 1, customerIds: [claim.customer.id] });
            }
          });
          return Array.from(customerGroupMap.values())
            .map((group) => ({ customerId: group.customerIds[0], customerName: group.customerName, count: group.count }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 10);
        } catch (error) {
          console.error("Error fetching claims by customer:", error);
          return [];
        }
      })(),
      // Recent claims (last 10)
      prisma.claim
        .findMany({
          take: 10,
          orderBy: { createdAt: "desc" },
          select: {
            id: true,
            claimCodeRaw: true,
            status: true,
            createdAt: true,
            customer: { select: { name: true, company: true } },
          },
        })
        .catch((error) => {
          console.error("Error fetching recent claims:", error);
          return [] as Array<{ id: string; claimCodeRaw: string | null; status: string; customer: { name: string | null; company: string | null } | null; createdAt: Date }>;
        }),
      // Unread threads (Outlook-style)
      countEffectivelyUnreadThreads(prisma).catch((error) => {
        console.error("Error fetching unread emails count:", error);
        return 0;
      }),
      // IN_ANALYSIS claims (urgent computed below)
      prisma.claim
        .findMany({
          where: { status: "IN_ANALYSIS" },
          select: {
            id: true,
            claimCodeRaw: true,
            status: true,
            createdAt: true,
            claimArrivalDate: true,
            customer: { select: { name: true, company: true } },
          },
        })
        .catch((error) => {
          console.error("Error fetching urgent claims:", error);
          return [] as Array<{ id: string; claimCodeRaw: string | null; status: string; createdAt: Date; claimArrivalDate: Date | null; customer: { name: string | null; company: string | null } | null }>;
        }),
      // Claims in last 12 months with final status (for trend chart)
      prisma.claim
        .findMany({
          where: { createdAt: { gte: twelveMonthsAgo }, status: { in: ["APPROVED", "REJECTED"] } },
          select: { status: true, createdAt: true },
        })
        .catch((error) => {
          console.error("Error fetching claims by month:", error);
          return [] as Array<{ status: string; createdAt: Date }>;
        }),
    ]);

    // Final status breakdown (derived, no query)
    const claimsByAcceptanceStatus = [
      { acceptanceStatus: "APPROVED", count: approvedCount },
      { acceptanceStatus: "REJECTED", count: rejectedCount },
    ].filter((item) => item.count > 0);

    // Urgent: IN_ANALYSIS older than 7 days (arrival date if present, else createdAt)
    const urgentClaims = allInAnalysis
      .filter((claim) => {
        const referenceDate = claim.claimArrivalDate ? new Date(claim.claimArrivalDate) : new Date(claim.createdAt);
        return referenceDate < sevenDaysAgo;
      })
      .sort((a, b) => {
        const dateA = a.claimArrivalDate ? new Date(a.claimArrivalDate) : new Date(a.createdAt);
        const dateB = b.claimArrivalDate ? new Date(b.claimArrivalDate) : new Date(b.createdAt);
        return dateA.getTime() - dateB.getTime();
      })
      .slice(0, 10);

    // Claims by month for the trend chart (last 12 months)
    const monthMap = new Map<string, { accepted: number; rejected: number; label: string }>();
    const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
    for (let i = 11; i >= 0; i--) {
      const date = new Date();
      date.setMonth(date.getMonth() - i);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}.`;
      monthMap.set(monthKey, { accepted: 0, rejected: 0, label: monthLabel });
    }
    monthClaims.forEach((claim) => {
      const date = new Date(claim.createdAt);
      const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      const monthData = monthMap.get(monthKey);
      if (monthData) {
        if (claim.status === "APPROVED") monthData.accepted++;
        else if (claim.status === "REJECTED") monthData.rejected++;
      }
    });
    const claimsByMonth = Array.from(monthMap.values()).map((data) => ({
      month: data.label,
      accepted: data.accepted,
      rejected: data.rejected,
    }));

    const stats = {
      totalClaims,
      resolvedCount,
      approvedCount,
      rejectedCount,
      inProcessCount,
      unreadEmailsCount,
      claimsByCustomer: claimsByCustomerWithNames,
      claimsByStatus: claimsByStatus.map((s) => ({
        status: s.status,
        count: s._count.id,
      })),
      claimsByAcceptanceStatus,
      recentClaims: recentClaims.map((c) => ({
        id: c.id,
        claimCodeRaw: c.claimCodeRaw,
        status: c.status,
        customer: c.customer,
        createdAt: c.createdAt.toISOString(),
      })),
      urgentClaims: urgentClaims.map((c) => ({
        id: c.id,
        claimCodeRaw: c.claimCodeRaw,
        status: c.status,
        customer: c.customer,
        createdAt: c.createdAt.toISOString(),
        claimArrivalDate: c.claimArrivalDate ? c.claimArrivalDate.toISOString() : null,
      })),
      claimsByMonth,
    };

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;

    // Update cache
    cachedStats = stats;
    cacheTimestamp = now;
    
    return NextResponse.json(stats, {
      headers: {
        'Cache-Control': 'public, s-maxage=5, stale-while-revalidate=10',
      },
    });
  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error";
    return NextResponse.json(
      { error: `Failed to fetch dashboard stats: ${errorMessage}` },
      { status: 500 }
    );
  }
}

