/**
 * API routes for managing predefined workers (SUPER_ADMIN only)
 * GET /api/admin/workers - List all workers
 * POST /api/admin/workers - Create new worker
 */

import { NextRequest, NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";
import { SEED_PREDEFINED_WORKER_NAMES } from "@/lib/config/predefinedSeeds";

export async function GET() {
  try {
    const prisma = await getPrisma();
    
    // Try to get workers from database, fallback to empty array if table doesn't exist
    let workers: { id: string; name: string }[] = [];
    try {
      workers = await prisma.predefinedWorker.findMany({
        orderBy: { name: "asc" },
      });
      if (workers.length === 0) {
        await prisma.predefinedWorker.createMany({
          data: SEED_PREDEFINED_WORKER_NAMES.map((name) => ({ name })),
        });
        workers = await prisma.predefinedWorker.findMany({
          orderBy: { name: "asc" },
        });
        if (workers.length > 0) {
          console.warn("[GET /api/admin/workers] Table was empty; re-seeded default workers.");
        }
      }
    } catch (error) {
      console.warn("[GET /api/admin/workers] PredefinedWorker table might not exist:", error);
      workers = SEED_PREDEFINED_WORKER_NAMES.map((name, i) => ({
        id: `fallback-${i}`,
        name,
      }));
    }

    return NextResponse.json({ workers });
  } catch (error) {
    console.error("Error fetching workers:", error);
    return NextResponse.json(
      { error: "Failed to fetch workers" },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const prisma = await getPrisma();
    // Only SUPER_ADMIN can create workers
    await requireMinimumRole(ROLES.SUPER_ADMIN);

    const body = await request.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json(
        { error: "Worker name is required" },
        { status: 400 }
      );
    }

    const worker = await prisma.predefinedWorker.create({
      data: {
        name: name.trim().toUpperCase(),
      },
    });

    return NextResponse.json({ worker }, { status: 201 });
  } catch (error: any) {
    console.error("Error creating worker:", error);
    if (error.code === "P2002") {
      return NextResponse.json(
        { error: "Worker with this name already exists" },
        { status: 409 }
      );
    }
    return NextResponse.json(
      { error: "Failed to create worker" },
      { status: 500 }
    );
  }
}
