"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Dashboard error:", error);
  }, [error]);

  return (
    <div className="p-8 flex items-center justify-center min-h-[400px]">
      <Card className="p-6 max-w-md">
        <div className="flex items-center gap-3 mb-4">
          <AlertCircle className="h-6 w-6 text-destructive" />
          <h2 className="text-xl font-semibold">Greška u Dashboard-u</h2>
        </div>
        <p className="text-muted-foreground mb-4">
          Došlo je do greške pri učitavanju dashboard-a. Molimo pokušajte ponovo.
        </p>
        <Button onClick={reset} variant="default">
          Pokušaj ponovo
        </Button>
      </Card>
    </div>
  );
}

