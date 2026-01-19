"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { useTranslations } from "next-intl";
import { clearApprovalCache } from "@/components/approval-guard";

export default function PendingApprovalPage() {
  const { user } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(false);
  const t = useTranslations('pendingApproval');

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      // Clear cache to force fresh check
      clearApprovalCache();
      
      const res = await fetch("/api/auth/check-approval");
      const data = await res.json();
      
      if (data.approved) {
        // User has been approved, redirect to dashboard
        router.push("/");
        router.refresh();
      } else {
        // Still pending
        alert(t('stillPending'));
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    clearApprovalCache();
    window.location.href = "/auth/logout";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
          <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">{t('title')}</h1>
          <p className="text-muted-foreground">
            {t('description')}
          </p>
        </div>

        {user && (
          <div className="p-4 bg-muted rounded-lg">
            <div className="flex items-center gap-3 justify-center">
              <Mail className="w-5 h-5 text-muted-foreground" />
              <span className="font-medium">{user.email}</span>
            </div>
          </div>
        )}

        <div className="space-y-3">
          <Button 
            onClick={handleCheckStatus} 
            className="w-full"
            disabled={checking}
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                {t('checking')}
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                {t('checkStatus')}
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            {t('logout')}
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          {t('adminNote')}
        </p>
      </Card>
    </div>
  );
}
