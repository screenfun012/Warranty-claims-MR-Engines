import { NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET() {
  try {
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
        claimsByStatus = await prisma.claim.groupBy({
          by: ["status"],
          _count: {
            id: true,
          },
        });
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

    // Get resolved claims (CLOSED)
    let resolvedCount = 0;
    try {
      resolvedCount = claimsByStatus.find((s) => s.status === "CLOSED")?._count.id || 0;
    } catch (error) {
      console.error("Error calculating resolved count:", error);
    }

    // Get approved claims - based on claimAcceptanceStatus = "ACCEPTED"
    // Use raw SQL to ensure we get the latest values (Prisma might cache after raw SQL updates)
    let approvedCount = 0;
    try {
      const approvedResult = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
        `SELECT COUNT(*) as count FROM Claim WHERE claimAcceptanceStatus = 'ACCEPTED'`
      );
      approvedCount = Number(approvedResult[0]?.count || 0);
    } catch (error) {
      console.warn("Error counting approved claims:", error);
      // Fallback to Prisma
      try {
        approvedCount = await prisma.claim.count({
          where: {
            claimAcceptanceStatus: "ACCEPTED",
          },
        });
      } catch (fallbackError) {
        console.warn("Fallback also failed:", fallbackError);
      }
    }

    // Get rejected claims - based on claimAcceptanceStatus = "REJECTED"
    // Use raw SQL to ensure we get the latest values
    let rejectedCount = 0;
    try {
      const rejectedResult = await prisma.$queryRawUnsafe<Array<{ count: bigint | number }>>(
        `SELECT COUNT(*) as count FROM Claim WHERE claimAcceptanceStatus = 'REJECTED'`
      );
      rejectedCount = Number(rejectedResult[0]?.count || 0);
    } catch (error) {
      console.warn("Error counting rejected claims:", error);
      // Fallback to Prisma
      try {
        rejectedCount = await prisma.claim.count({
          where: {
            claimAcceptanceStatus: "REJECTED",
          },
        });
      } catch (fallbackError) {
        console.warn("Fallback also failed:", fallbackError);
      }
    }

    // Get in process claims (NEW, IN_ANALYSIS, WAITING_CUSTOMER) - exclude CLOSED
    let inProcessCount = 0;
    try {
      try {
        inProcessCount = await prisma.claim.count({
          where: {
            status: {
              in: ["NEW", "IN_ANALYSIS", "WAITING_CUSTOMER"],
            },
          },
        });
      } catch (error) {
        // Fallback: count manually if `in` operator fails
        console.warn("Error counting in-process claims, using fallback:", error);
        const newCount = await prisma.claim.count({ where: { status: "NEW" } }).catch(() => 0);
        const analysisCount = await prisma.claim.count({ where: { status: "IN_ANALYSIS" } }).catch(() => 0);
        const waitingCount = await prisma.claim.count({ where: { status: "WAITING_CUSTOMER" } }).catch(() => 0);
        inProcessCount = newCount + analysisCount + waitingCount;
      }
    } catch (error) {
      console.error("Error calculating in-process count:", error);
    }

    // Get claims by customer (top 10) - handle SQLite limitations
    let claimsByCustomer: Array<{ customerId: string | null; _count: { id: number } }> = [];
    try {
      try {
        claimsByCustomer = await prisma.claim.groupBy({
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
    let customers: Array<{ id: string; name: string }> = [];
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
          },
        });
      } catch (error) {
        console.warn("Error fetching customer names:", error);
      }
    }

    const customerMap = new Map(customers.map((c) => [c.id, c.name]));

    let claimsByCustomerWithNames: Array<{ customerId: string | null; customerName: string; count: number }> = [];
    try {
      claimsByCustomerWithNames = claimsByCustomer.map((item) => ({
        customerId: item.customerId,
        customerName: item.customerId ? customerMap.get(item.customerId) || "Unknown" : "Unknown",
        count: item._count.id,
      }));
    } catch (error) {
      console.error("Error mapping claims by customer:", error);
    }

    // Get claims by acceptance status
    let claimsByAcceptanceStatus: Array<{ acceptanceStatus: string; count: number }> = [];
    try {
      const acceptanceStatusResult = await prisma.$queryRawUnsafe<Array<{ claimAcceptanceStatus: string | null; count: bigint | number }>>(
        `SELECT claimAcceptanceStatus, COUNT(*) as count FROM Claim WHERE claimAcceptanceStatus IS NOT NULL GROUP BY claimAcceptanceStatus`
      );
      claimsByAcceptanceStatus = acceptanceStatusResult.map((item) => ({
        acceptanceStatus: item.claimAcceptanceStatus || "UNKNOWN",
        count: Number(item.count || 0),
      }));
    } catch (error) {
      console.warn("Error fetching claims by acceptance status:", error);
      // Fallback: count manually
      const allClaims = await prisma.claim.findMany({
        select: { claimAcceptanceStatus: true },
      });
      const acceptanceMap = new Map<string | null, number>();
      allClaims.forEach((claim) => {
        if (claim.claimAcceptanceStatus) {
          acceptanceMap.set(claim.claimAcceptanceStatus, (acceptanceMap.get(claim.claimAcceptanceStatus) || 0) + 1);
        }
      });
      claimsByAcceptanceStatus = Array.from(acceptanceMap.entries()).map(([acceptanceStatus, count]) => ({
        acceptanceStatus: acceptanceStatus || "UNKNOWN",
        count,
      }));
    }

    // Get recent claims (last 10)
    let recentClaims: Array<{
      id: string;
      claimCodeRaw: string | null;
      status: string;
      customer: { name: string } | null;
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

    // Get urgent claims (WAITING_CUSTOMER or NEW that are older than 7 days)
    let urgentClaims: Array<{
      id: string;
      claimCodeRaw: string | null;
      status: string;
      customer: { name: string } | null;
      createdAt: Date;
    }> = [];
    try {
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
      
      urgentClaims = await prisma.claim.findMany({
        where: {
          OR: [
            { status: "WAITING_CUSTOMER" },
            {
              status: "NEW",
              createdAt: {
                lt: sevenDaysAgo,
              },
            },
          ],
        },
        take: 5,
        orderBy: {
          createdAt: "asc",
        },
        select: {
          id: true,
          claimCodeRaw: true,
          status: true,
          createdAt: true,
          customer: {
            select: {
              name: true,
            },
          },
        },
      });
    } catch (error) {
      console.error("Error fetching urgent claims:", error);
    }

    return NextResponse.json({
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
      })),
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

