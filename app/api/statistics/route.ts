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
    // Only ADMIN+ can read statistics
    const { requireMinimumRole } = await import("@/lib/auth/permissions");
    const { ROLES } = await import("@/lib/auth/roles");
    await requireMinimumRole(ROLES.ADMIN);

    const searchParams = request.nextUrl.searchParams;
    
    // Filter parameters
    const status = searchParams.getAll("status");
    const customerNames = searchParams.getAll("customerName");
    const customerCompanies = searchParams.getAll("customerCompany");
    const faultDepartmentId = searchParams.getAll("faultDepartmentId");
    const yearEngineDone = searchParams.get("yearEngineDone");
    const isDomesticMarket = searchParams.get("isDomesticMarket");
    const engineType = searchParams.get("engineType");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause
    const where: any = {};

    // Status filter
    // Unified status filter - all statuses use the main status field
    if (status.length > 0) {
      // Map ACCEPTED to APPROVED for backwards compatibility
      const mappedStatuses = status.map(s => s === "ACCEPTED" ? "APPROVED" : s);
      where.status = { in: mappedStatuses };
    }

    // Customer filters - support multi-select for names and companies
    if (customerNames.length > 0 || customerCompanies.length > 0) {
      const customerConditions: any = {};
      if (customerNames.length > 0) {
        customerConditions.name = { in: customerNames };
      }
      if (customerCompanies.length > 0) {
        customerConditions.company = { in: customerCompanies };
      }
      where.customer = customerConditions;
    }

    // Fault department filter - support both single and multiple departments
    if (faultDepartmentId.length > 0) {
      where.OR = [
        { faultDepartmentId: { in: faultDepartmentId } }, // Legacy single department
        { faultDepartments: { some: { id: { in: faultDepartmentId } } } }, // Multiple departments
      ];
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

    // Base include without faultDepartments
    const baseInclude = {
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
    };

    // Fetch claims with all necessary relations - try with faultDepartments, fallback without
    let claims;
    try {
      claims = await prisma.claim.findMany({
        where,
        include: {
          ...baseInclude,
          faultDepartments: {
            select: {
              id: true,
              name: true,
            },
          },
        },
        orderBy: {
          createdAt: "desc",
        },
      });
    } catch (faultDeptError) {
      console.warn("[GET /api/statistics] faultDepartments include failed, trying without:", faultDeptError);
      claims = await prisma.claim.findMany({
        where,
        include: baseInclude,
        orderBy: {
          createdAt: "desc",
        },
      });
    }

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
