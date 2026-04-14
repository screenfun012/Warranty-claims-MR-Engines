/**
 * API route for statistics
 * GET /api/statistics - Get claim statistics with filters
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { enrichClaimsForListView } from "@/lib/claims/enrichClaimsList";

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
    const workerNames = searchParams.getAll("workerName").filter((n) => n.trim() !== "");
    const yearEngineDone = searchParams.get("yearEngineDone");
    const isDomesticMarket = searchParams.get("isDomesticMarket");
    const engineType = searchParams.get("engineType");
    const dateFrom = searchParams.get("dateFrom");
    const dateTo = searchParams.get("dateTo");

    // Build where clause — sve grane u AND da se worker i odeljenje mogu kombinovati
    const andParts: any[] = [];

    if (status.length > 0) {
      const mappedStatuses = status.map((s) => (s === "ACCEPTED" ? "APPROVED" : s));
      andParts.push({ status: { in: mappedStatuses } });
    }

    if (customerNames.length > 0 || customerCompanies.length > 0) {
      const customerConditions: any = {};
      if (customerNames.length > 0) {
        customerConditions.name = { in: customerNames };
      }
      if (customerCompanies.length > 0) {
        customerConditions.company = { in: customerCompanies };
      }
      andParts.push({ customer: customerConditions });
    }

    if (faultDepartmentId.length > 0) {
      andParts.push({
        OR: [
          { faultDepartmentId: { in: faultDepartmentId } },
          { faultDepartments: { some: { id: { in: faultDepartmentId } } } },
        ],
      });
    }

    // Radnik koji je radio motor: tekst na claim-u, User assignedTo, ili radnik sa radnog naloga
    if (workerNames.length > 0) {
      andParts.push({
        OR: [
          { assignedWorkerName: { in: workerNames } },
          { assignedTo: { fullName: { in: workerNames } } },
          { workOrder: { worker: { fullName: { in: workerNames } } } },
        ],
      });
    }

    if (yearEngineDone) {
      andParts.push({ yearEngineDone: parseInt(yearEngineDone, 10) });
    }

    if (isDomesticMarket !== null && isDomesticMarket !== "") {
      andParts.push({ isDomesticMarket: isDomesticMarket === "true" });
    }

    if (engineType) {
      andParts.push({
        engineType: {
          contains: engineType,
        },
      });
    }

    if (dateFrom || dateTo) {
      const createdAt: { gte?: Date; lte?: Date } = {};
      if (dateFrom) {
        createdAt.gte = new Date(dateFrom);
      }
      if (dateTo) {
        createdAt.lte = new Date(dateTo);
      }
      andParts.push({ createdAt });
    }

    const where: any = andParts.length > 0 ? { AND: andParts } : {};

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
      workOrder: {
        select: {
          id: true,
          assemblyDate: true,
          worker: {
            select: { id: true, fullName: true },
          },
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

    claims = (await enrichClaimsForListView(prisma, claims)) as typeof claims;

    // Get total count
    const totalCount = await prisma.claim.count({ where });

    return NextResponse.json(
      {
        claims,
        totalCount,
      },
      {
        headers: {
          "Cache-Control": "private, no-store, max-age=0",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching statistics:", error);
    return NextResponse.json(
      { error: "Failed to fetch statistics" },
      { status: 500 }
    );
  }
}
