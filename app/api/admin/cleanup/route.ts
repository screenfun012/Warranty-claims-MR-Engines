/**
 * API routes for cleaning up orphaned data (SUPER_ADMIN only)
 * POST /api/admin/cleanup - Clean up orphaned customers
 * GET /api/admin/cleanup - Get count of orphaned data
 */

import { NextResponse } from "next/server";
import { getPrisma } from "@/lib/db/prisma";
import { requireMinimumRole } from "@/lib/auth/permissions";
import { ROLES } from "@/lib/auth/roles";

// Get count of orphaned data
export async function GET() {
  try {
    const prisma = await getPrisma();
    await requireMinimumRole(ROLES.SUPER_ADMIN);

    // Count orphaned customers (customers with no claims)
    const allCustomers = await prisma.customer.findMany({
      select: { id: true },
    });
    
    let orphanedCustomerCount = 0;
    for (const customer of allCustomers) {
      const claimCount = await prisma.claim.count({
        where: { customerId: customer.id },
      });
      if (claimCount === 0) {
        orphanedCustomerCount++;
      }
    }

    return NextResponse.json({
      orphanedCustomers: orphanedCustomerCount,
    });
  } catch (error) {
    console.error("Error getting cleanup stats:", error);
    return NextResponse.json(
      { error: "Failed to get cleanup stats" },
      { status: 500 }
    );
  }
}

// Clean up orphaned data
export async function POST() {
  try {
    const prisma = await getPrisma();
    await requireMinimumRole(ROLES.SUPER_ADMIN);

    // Find and delete orphaned customers (customers with no claims)
    const allCustomers = await prisma.customer.findMany({
      select: { id: true, name: true, company: true },
    });
    
    const deletedCustomers: string[] = [];
    for (const customer of allCustomers) {
      const claimCount = await prisma.claim.count({
        where: { customerId: customer.id },
      });
      if (claimCount === 0) {
        await prisma.customer.delete({
          where: { id: customer.id },
        });
        deletedCustomers.push(customer.company || customer.name || customer.id);
      }
    }

    console.log(`[Cleanup] Deleted ${deletedCustomers.length} orphaned customers:`, deletedCustomers);

    return NextResponse.json({
      success: true,
      deletedCustomers: deletedCustomers.length,
      details: deletedCustomers,
    });
  } catch (error) {
    console.error("Error during cleanup:", error);
    return NextResponse.json(
      { error: "Failed to clean up data" },
      { status: 500 }
    );
  }
}
