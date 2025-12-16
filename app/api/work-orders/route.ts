/**
 * API routes for work orders
 * GET /api/work-orders - List work orders
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(request: NextRequest) {
  try {
    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search");

    const where: any = {};
    if (search) {
      where.workOrderCode = {
        contains: search,
      };
    }

    const workOrders = await prisma.workOrder.findMany({
      where,
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        claims: {
          select: {
            id: true,
          },
        },
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Add claim count
    const workOrdersWithCount = workOrders.map((wo) => ({
      ...wo,
      claimCount: wo.claims.length,
    }));

    return NextResponse.json({ workOrders: workOrdersWithCount });
  } catch (error) {
    console.error("Error fetching work orders:", error);
    return NextResponse.json(
      { error: "Failed to fetch work orders" },
      { status: 500 }
    );
  }
}

