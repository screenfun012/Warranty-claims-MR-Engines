"use client";

import { useEffect, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Skeleton } from "@/components/ui/skeleton";

interface ApprovalGuardProps {
  children: React.ReactNode;
}

export function ApprovalGuard({ children }: ApprovalGuardProps) {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [isApproved, setIsApproved] = useState<boolean | null>(null);
  const [checking, setChecking] = useState(true);

  // Skip check for these paths
  const skipPaths = ['/pending-approval', '/auth', '/login'];
  const shouldSkip = skipPaths.some(path => pathname?.startsWith(path));

  useEffect(() => {
    // Skip if no user or on exempt paths
    if (userLoading || shouldSkip) {
      setChecking(false);
      return;
    }

    if (!user) {
      setChecking(false);
      return;
    }

    // Check approval status
    const checkApproval = async () => {
      try {
        const res = await fetch("/api/auth/check-approval");
        const data = await res.json();

        if (data.approved) {
          setIsApproved(true);
        } else {
          setIsApproved(false);
          // Redirect to pending approval page
          router.push("/pending-approval");
        }
      } catch (error) {
        console.error("Error checking approval:", error);
        // On error, assume approved to not block users
        setIsApproved(true);
      } finally {
        setChecking(false);
      }
    };

    checkApproval();
  }, [user, userLoading, router, shouldSkip]);

  // Show loading while checking
  if (userLoading || (checking && !shouldSkip)) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="space-y-4 w-full max-w-md p-8">
          <Skeleton className="h-8 w-48 mx-auto" />
          <Skeleton className="h-4 w-64 mx-auto" />
          <div className="space-y-3 mt-8">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        </div>
      </div>
    );
  }

  // If not approved and not on pending page, show nothing (redirect will happen)
  if (isApproved === false && !shouldSkip) {
    return null;
  }

  return <>{children}</>;
}
