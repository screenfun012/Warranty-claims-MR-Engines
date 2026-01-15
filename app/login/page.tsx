"use client";

import { useUser } from "@auth0/nextjs-auth0/client";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Chrome } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

export default function LoginPage() {
  const { user, isLoading } = useUser();
  const router = useRouter();

  useEffect(() => {
    if (user) {
      router.push("/");
    }
  }, [user, router]);

  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
        <Card className="w-full max-w-md p-8">
          <div className="text-center">
            <p className="text-muted-foreground">Učitavanje...</p>
          </div>
        </Card>
      </div>
    );
  }

  if (user) {
    return null; // Redirect će se desiti u useEffect
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 dark:bg-gray-900 p-4">
      <Card className="w-full max-w-md p-8">
        <h1 className="text-2xl font-bold text-center mb-8">
          Prijava na sistem
        </h1>

        <div className="space-y-3 mb-6">
          <a 
            href="/auth/login" 
            className="block"
            // Optimizacija: Prefetch Auth0 login stranicu za brže učitavanje
            rel="prefetch"
          >
            <Button
              variant="outline"
              className="w-full flex items-center justify-center gap-3"
            >
              <Chrome className="w-5 h-5" />
              <span>Prijavi se</span>
            </Button>
          </a>
        </div>

        <p className="text-center text-sm text-muted-foreground mt-6">
          MR Engines Warranty Claims Management System
        </p>
      </Card>
    </div>
  );
}
