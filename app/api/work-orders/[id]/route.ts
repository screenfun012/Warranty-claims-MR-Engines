/**
 * API routes for individual work orders
 * GET /api/work-orders/[id] - Get work order details
 */

import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db/prisma";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id } = await params;

    const workOrder = await prisma.workOrder.findUnique({
      where: { id },
      include: {
        worker: {
          select: {
            id: true,
            fullName: true,
            email: true,
          },
        },
        claims: {
          include: {
            customer: {
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
        },
      },
    });

    if (!workOrder) {
      return NextResponse.json({ error: "Work order not found" }, { status: 404 });
    }

    return NextResponse.json({ workOrder });
  } catch (error) {
    console.error("Error fetching work order:", error);
    return NextResponse.json(
      { error: "Failed to fetch work order" },
      { status: 500 }
    );
  }
}
