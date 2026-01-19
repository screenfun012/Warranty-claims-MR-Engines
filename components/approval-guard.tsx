"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { useUser } from "@auth0/nextjs-auth0/client";
import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";
import { Loader2 } from "lucide-react";

interface ApprovalGuardProps {
  children: React.ReactNode;
}

const APPROVAL_CACHE_KEY = 'user-approval-status';
const APPROVAL_CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

interface ApprovalCache {
  approved: boolean;
  timestamp: number;
  email: string;
}

function getApprovalCache(email: string): boolean | null {
  if (typeof window === 'undefined') return null;
  
  try {
    const cached = localStorage.getItem(APPROVAL_CACHE_KEY);
    if (!cached) return null;
    
    const data: ApprovalCache = JSON.parse(cached);
    
    // Check if cache is for same user and not expired
    if (data.email === email && Date.now() - data.timestamp < APPROVAL_CACHE_DURATION) {
      return data.approved;
    }
    
    // Cache expired or different user
    localStorage.removeItem(APPROVAL_CACHE_KEY);
    return null;
  } catch {
    return null;
  }
}

function setApprovalCache(email: string, approved: boolean) {
  if (typeof window === 'undefined') return;
  
  try {
    const data: ApprovalCache = {
      approved,
      timestamp: Date.now(),
      email,
    };
    localStorage.setItem(APPROVAL_CACHE_KEY, JSON.stringify(data));
  } catch {
    // Ignore localStorage errors
  }
}

export function ApprovalGuard({ children }: ApprovalGuardProps) {
  const { user, isLoading: userLoading } = useUser();
  const router = useRouter();
  const pathname = usePathname();
  const [approvalState, setApprovalState] = useState<'loading' | 'approved' | 'pending' | 'error'>('loading');

  // Skip check for these paths
  const skipPaths = ['/pending-approval', '/auth', '/login'];
  const shouldSkip = skipPaths.some(path => pathname?.startsWith(path));

  const checkApproval = useCallback(async (email: string) => {
    // First check cache
    const cachedApproval = getApprovalCache(email);
    if (cachedApproval !== null) {
      if (cachedApproval) {
        setApprovalState('approved');
      } else {
        setApprovalState('pending');
        router.replace("/pending-approval");
      }
      return;
    }

    // No cache, fetch from server
    try {
      const res = await fetch("/api/auth/check-approval");
      const data = await res.json();

      if (data.approved) {
        setApprovalCache(email, true);
        setApprovalState('approved');
      } else {
        setApprovalCache(email, false);
        setApprovalState('pending');
        router.replace("/pending-approval");
      }
    } catch (error) {
      console.error("Error checking approval:", error);
      // On error, assume approved to not block users
      setApprovalState('approved');
    }
  }, [router]);

  useEffect(() => {
    // Skip if on exempt paths
    if (shouldSkip) {
      setApprovalState('approved');
      return;
    }

    // Wait for user loading
    if (userLoading) {
      return;
    }

    // No user means not logged in, let Auth0 handle it
    if (!user || !user.email) {
      setApprovalState('approved');
      return;
    }

    // Check approval status
    checkApproval(user.email);
  }, [user, userLoading, shouldSkip, checkApproval]);

  // Show loading screen while checking
  if (userLoading || approvalState === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center space-y-4 max-w-sm mx-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Učitavanje...</h2>
            <p className="text-sm text-muted-foreground">Proveravam pristup...</p>
          </div>
        </Card>
      </div>
    );
  }

  // If pending approval, show nothing (redirect will happen)
  if (approvalState === 'pending') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Card className="p-8 text-center space-y-4 max-w-sm mx-4">
          <Loader2 className="h-8 w-8 animate-spin mx-auto text-primary" />
          <div className="space-y-2">
            <h2 className="text-lg font-semibold">Preusmeravanje...</h2>
          </div>
        </Card>
      </div>
    );
  }

  return <>{children}</>;
}

// Clear approval cache (call on logout)
export function clearApprovalCache() {
  if (typeof window === 'undefined') return;
  localStorage.removeItem(APPROVAL_CACHE_KEY);
}
