import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, createPermissionError, PERMISSIONS } from "@/lib/auth/permissions";

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
    
    // Get total claims count
    let totalClaims = 0;
    try {
      totalClaims = await prisma.claim.count();
    } catch (error) {
      console.error("Error counting total claims:", error);
    }

    // Get claims by status - handle SQLite limitations
    let claimsByStatus: Array<{ status: string; _count: { id: number } }> = [];
    try {
      try {
        const result = await prisma.claim.groupBy({
          by: ["status"],
          _count: {
            id: true,
          },
        });
        claimsByStatus = result as Array<{ status: string; _count: { id: number } }>;
      } catch (groupByError) {
        // Fallback for SQLite if groupBy fails
        console.warn("groupBy failed, using fallback:", groupByError);
        const allClaims = await prisma.claim.findMany({
          select: { status: true },
        });
        const statusMap = new Map<string, number>();
        allClaims.forEach((claim) => {
          statusMap.set(claim.status, (statusMap.get(claim.status) || 0) + 1);
        });
        claimsByStatus = Array.from(statusMap.entries()).map(([status, count]) => ({
          status,
          _count: { id: count },
        }));
      }
    } catch (error) {
      console.error("Error fetching claims by status:", error);
    }

    // Get approved claims - based on status = 'APPROVED' (unified status system)
    let approvedCount = 0;
    try {
      approvedCount = await prisma.claim.count({
        where: {
          status: "APPROVED",
        },
      });
    } catch (error) {
      console.warn("Error counting approved claims:", error);
    }

    // Get rejected claims - based on status = 'REJECTED' (unified status system)
    let rejectedCount = 0;
    try {
      rejectedCount = await prisma.claim.count({
        where: {
          status: "REJECTED",
        },
      });
    } catch (error) {
      console.warn("Error counting rejected claims:", error);
    }

    // Get resolved claims (APPROVED + REJECTED) - završene reklamacije
    let resolvedCount = 0;
    try {
      resolvedCount = approvedCount + rejectedCount;
    } catch (error) {
      console.error("Error calculating resolved count:", error);
    }

    // Get in process claims (NEW, IN_ANALYSIS) - exclude CLOSED
    let inProcessCount = 0;
    try {
      try {
        inProcessCount = await prisma.claim.count({
          where: {
            status: {
              in: ["NEW", "IN_ANALYSIS"],
            },
          },
        });
      } catch (error) {
        // Fallback: count manually if `in` operator fails
        console.warn("Error counting in-process claims, using fallback:", error);
        const newCount = await prisma.claim.count({ where: { status: "NEW" } }).catch(() => 0);
        const analysisCount = await prisma.claim.count({ where: { status: "IN_ANALYSIS" } }).catch(() => 0);
        inProcessCount = newCount + analysisCount;
      }
    } catch (error) {
      console.error("Error calculating in-process count:", error);
    }

    // Get claims by customer (top 10) - handle SQLite limitations
    let claimsByCustomer: Array<{ customerId: string | null; _count: { id: number } }> = [];
    try {
      try {
        const customerResult = await prisma.claim.groupBy({
          by: ["customerId"],
          _count: {
            id: true,
          },
          where: {
            customerId: {
              not: null,
            },
          },
          orderBy: {
            _count: {
              id: "desc",
            },
          },
          take: 10,
        });
        claimsByCustomer = customerResult as Array<{ customerId: string | null; _count: { id: number } }>;
      } catch (groupByError) {
        // Fallback for SQLite if groupBy fails
        console.warn("groupBy for customers failed, using fallback:", groupByError);
        const allClaimsWithCustomer = await prisma.claim.findMany({
          where: {
            customerId: {
              not: null,
            },
          },
          select: { customerId: true },
        });
        const customerMap = new Map<string | null, number>();
        allClaimsWithCustomer.forEach((claim) => {
          customerMap.set(claim.customerId, (customerMap.get(claim.customerId) || 0) + 1);
        });
        claimsByCustomer = Array.from(customerMap.entries())
          .map(([customerId, count]) => ({
            customerId,
            _count: { id: count },
          }))
          .sort((a, b) => b._count.id - a._count.id)
          .slice(0, 10);
      }
    } catch (error) {
      console.error("Error fetching claims by customer:", error);
    }

    // Get customer names for the top customers
    const customerIds = claimsByCustomer.map((c) => c.customerId).filter((id): id is string => id !== null);
    let customers: Array<{ id: string; name: string | null; company: string | null }> = [];
    if (customerIds.length > 0) {
      try {
        customers = await prisma.customer.findMany({
          where: {
            id: {
              in: customerIds,
            },
          },
          select: {
            id: true,
            name: true,
            company: true,
          },
        });
      } catch (error) {
        console.warn("Error fetching customer names:", error);
      }
    }

    const customerMap = new Map(customers.map((c) => [c.id, { name: c.name, company: c.company }]));

    let claimsByCustomerWithNames: Array<{ customerId: string | null; customerName: string; count: number }> = [];
    try {
      claimsByCustomerWithNames = claimsByCustomer.map((item) => {
        const customer = item.customerId ? customerMap.get(item.customerId) : null;
        const displayName = customer 
          ? (customer.company || customer.name || "Unknown")
          : "Unknown";
        return {
          customerId: item.customerId,
          customerName: displayName,
          count: item._count.id,
        };
      });
    } catch (error) {
      console.error("Error mapping claims by customer:", error);
    }

    // Get claims by final status (APPROVED/REJECTED) - unified status system
    let claimsByAcceptanceStatus: Array<{ acceptanceStatus: string; count: number }> = [];
    try {
      claimsByAcceptanceStatus = [
        { acceptanceStatus: "APPROVED", count: approvedCount },
        { acceptanceStatus: "REJECTED", count: rejectedCount },
      ].filter(item => item.count > 0);
    } catch (error) {
      console.warn("Error building claims by acceptance status:", error);
    }

    // Get recent claims (last 10)
    let recentClaims: Array<{
      id: string;
      claimCodeRaw: string | null;
      status: string;
      customer: { name: string | null; company: string | null } | null;
      createdAt: Date;
    }> = [];
    try {
      recentClaims = await prisma.claim.findMany({
        take: 10,
        orderBy: {
          createdAt: "desc",
        },
        select: {
          id: true,
          claimCodeRaw: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
              company: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error fetching recent claims:", error);
    }

    // Get unread email threads count
    let unreadEmailsCount = 0;
    try {
      const unreadThreads = await prisma.emailThread.findMany({
        where: {
          viewedAt: null,
          claimId: null,
        },
        select: {
          id: true,
        },
      });
      unreadEmailsCount = unreadThreads.length;
    } catch (error) {
      console.error("Error fetching unread emails count:", error);
    }

    // Get urgent claims (IN_ANALYSIS status, older than 7 days)
    let urgentClaims: Array<{
      id: string;
      claimCodeRaw: string | null;
      status: string;
      customer: { name: string | null; company: string | null } | null;
      createdAt: Date;
      claimArrivalDate: Date | null;
    }> = [];
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      // Hitne reklamacije: samo IN_ANALYSIS status, starije od 7 dana
      // Koristi claimArrivalDate ako postoji, inače createdAt
      const allInAnalysis = await prisma.claim.findMany({
        where: {
          status: "IN_ANALYSIS",
        },
        select: {
          id: true,
          claimCodeRaw: true,
          status: true,
          createdAt: true,
          claimArrivalDate: true,
          customer: {
            select: {
              name: true,
              company: true,
            },
          },
        },
      });
      
      // Filter claims that are older than 7 days (using claimArrivalDate if available, otherwise createdAt)
      urgentClaims = allInAnalysis
        .filter((claim) => {
          const referenceDate = claim.claimArrivalDate 
            ? new Date(claim.claimArrivalDate) 
            : new Date(claim.createdAt);
          return referenceDate < sevenDaysAgo;
        })
        .slice(0, 10)
        .sort((a, b) => {
          const dateA = a.claimArrivalDate ? new Date(a.claimArrivalDate) : new Date(a.createdAt);
          const dateB = b.claimArrivalDate ? new Date(b.claimArrivalDate) : new Date(b.createdAt);
          return dateA.getTime() - dateB.getTime(); // Oldest first
        });
    } catch (error) {
      console.error("Error fetching urgent claims:", error);
    }

    // Get claims by month for trend chart (last 12 months) - unified status system
    let claimsByMonth: Array<{
      month: string;
      accepted: number;
      rejected: number;
    }> = [];
    try {
      const now = new Date();
      const twelveMonthsAgo = new Date();
      twelveMonthsAgo.setMonth(twelveMonthsAgo.getMonth() - 12);
      
      // Get all claims from last 12 months with APPROVED/REJECTED status
      const claims = await prisma.claim.findMany({
        where: {
          createdAt: {
            gte: twelveMonthsAgo,
          },
          status: {
            in: ["APPROVED", "REJECTED"],
          },
        },
        select: {
          status: true,
          createdAt: true,
        },
      });

      // Group by month
      const monthMap = new Map<string, { accepted: number; rejected: number; label: string }>();
      
      // Initialize all months (last 12 months) - use Latin month names
      const monthNames = ['jan', 'feb', 'mar', 'apr', 'maj', 'jun', 'jul', 'avg', 'sep', 'okt', 'nov', 'dec'];
      for (let i = 11; i >= 0; i--) {
        const date = new Date();
        date.setMonth(date.getMonth() - i);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthLabel = `${monthNames[date.getMonth()]} ${date.getFullYear()}.`;
        monthMap.set(monthKey, { accepted: 0, rejected: 0, label: monthLabel });
      }

      // Count claims by month using unified status
      claims.forEach((claim) => {
        const date = new Date(claim.createdAt);
        const monthKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const monthData = monthMap.get(monthKey);
        if (monthData) {
          if (claim.status === "APPROVED") {
            monthData.accepted++;
          } else if (claim.status === "REJECTED") {
            monthData.rejected++;
          }
        }
      });

      // Convert to array format - show all months, even if 0
      claimsByMonth = Array.from(monthMap.entries())
        .map(([key, data]) => ({
          month: data.label,
          accepted: data.accepted,
          rejected: data.rejected,
        }));
    } catch (error) {
      console.error("Error fetching claims by month:", error);
    }

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

