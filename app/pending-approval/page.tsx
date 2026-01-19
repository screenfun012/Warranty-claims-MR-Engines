"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Clock, Mail, LogOut, RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function PendingApprovalPage() {
  const { user } = useUser();
  const router = useRouter();
  const [checking, setChecking] = useState(false);

  const handleCheckStatus = async () => {
    setChecking(true);
    try {
      const res = await fetch("/api/auth/check-approval");
      const data = await res.json();
      
      if (data.approved) {
        // User has been approved, redirect to dashboard
        router.push("/");
        router.refresh();
      } else {
        // Still pending
        alert("Vaš nalog još uvek čeka odobrenje. Molimo pokušajte kasnije.");
      }
    } catch (error) {
      console.error("Error checking status:", error);
    } finally {
      setChecking(false);
    }
  };

  const handleLogout = () => {
    window.location.href = "/auth/logout";
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-background to-muted p-4">
      <Card className="max-w-md w-full p-8 text-center space-y-6">
        <div className="mx-auto w-16 h-16 rounded-full bg-orange-100 dark:bg-orange-900 flex items-center justify-center">
          <Clock className="w-8 h-8 text-orange-600 dark:text-orange-400" />
        </div>

        <div className="space-y-2">
          <h1 className="text-2xl font-bold">Čeka se odobrenje</h1>
          <p className="text-muted-foreground">
            Vaš nalog je kreiran, ali morate sačekati da vas administrator odobri pre nego što možete pristupiti aplikaciji.
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
          <p className="text-sm text-muted-foreground">
            Administrator će vas obavestiti kada vaš nalog bude odobren. Možete proveriti status klikom na dugme ispod.
          </p>

          <Button 
            onClick={handleCheckStatus} 
            className="w-full"
            disabled={checking}
          >
            {checking ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Proveravam...
              </>
            ) : (
              <>
                <RefreshCw className="w-4 h-4 mr-2" />
                Proveri status
              </>
            )}
          </Button>

          <Button 
            variant="outline" 
            onClick={handleLogout}
            className="w-full"
          >
            <LogOut className="w-4 h-4 mr-2" />
            Odjavi se
          </Button>
        </div>

        <p className="text-xs text-muted-foreground">
          Ako ste administrator i želite odobriti ovaj nalog, prijavite se na svoj admin nalog i idite na Admin → Upravljanje korisnicima.
        </p>
      </Card>
    </div>
  );
}
