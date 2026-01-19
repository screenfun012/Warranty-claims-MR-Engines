/**
 * API route for statistics
 * GET /api/statistics - Get claim statistics with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requirePermission, PERMISSIONS } from "@/lib/auth/permissions";

export async function GET(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // VIEWER+ can read statistics
    await requirePermission(PERMISSIONS.CLAIMS_READ);

    const searchParams = request.nextUrl.searchParams;
    
    // Filter parameters
    const status = searchParams.getAll("status");
    const customerId = searchParams.get("customerId");
    const customerCompany = searchParams.get("customerCompany");
    const faultDepartmentId = searchParams.getAll("faultDepartmentId");
    const yearEngineDone = searchParams.get("yearEngineDone");
    const isDomesticMarket = searchParams.get("isDomesticMarket");
    const engineType = searchParams.get("engineType");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: any = {};

    // Status filter
    if (status.length > 0) {
      const statusFilters = status.filter(s => !["ACCEPTED", "REJECTED"].includes(s));
      const acceptanceFilters = status.filter(s => ["ACCEPTED", "REJECTED"].includes(s));
      
      const orConditions: any[] = [];
      
      if (statusFilters.length > 0) {
        orConditions.push({ status: { in: statusFilters } });
      }
      
      if (acceptanceFilters.length > 0) {
        acceptanceFilters.forEach(af => {
          orConditions.push({ claimAcceptanceStatus: af });
        });
      }
      
      if (orConditions.length > 0) {
        where.OR = orConditions;
      }
    }

    // Customer filters (combine name and company if both provided)
    if (customerId || customerCompany) {
      const customerConditions: any = {};
      if (customerId) {
        customerConditions.name = { contains: customerId };
      }
      if (customerCompany) {
        customerConditions.company = { contains: customerCompany };
      }
      where.customer = customerConditions;
    }

    // Fault department filter
    if (faultDepartmentId.length > 0) {
      where.faultDepartmentId = { in: faultDepartmentId };
    }

    // Year engine done filter
    if (yearEngineDone) {
      where.yearEngineDone = parseInt(yearEngineDone, 10);
    }

    // Domestic market filter
    if (isDomesticMarket !== null && isDomesticMarket !== "") {
      where.isDomesticMarket = isDomesticMarket === "true";
    }

    // Engine type filter
    if (engineType) {
      where.engineType = {
        contains: engineType,
      };
    }

    // Date range filter
    if (dateFrom || dateTo) {
      where.createdAt = {};
      if (dateFrom) {
        where.createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        where.createdAt.lte = new Date(dateTo);
      }
    }

    // Fetch claims with all necessary relations
    const claims = await prisma.claim.findMany({
      where,
      include: {
        customer: {
          select: {
            id: true,
            name: true,
            company: true,
          },
        },
        faultDepartment: {
          select: {
            id: true,
            name: true,
          },
        },
        assignedTo: {
          select: {
            id: true,
            fullName: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Get total count
    const totalCount = await prisma.claim.count({ where });

    return NextResponse.json({
      claims,
      totalCount,
    });
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
