import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardContent } from "@/components/ui/card";

export default function InboxLoading() {
  return (
    <div className="p-6 space-y-4">
      <div className="flex items-center justify-between gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-2">
        {[1, 2, 3, 4, 5].map((i) => (
          <Card key={i} className="p-4">
            <CardContent className="p-0 flex items-center gap-4">
              <Skeleton className="h-10 w-10 rounded shrink-0" />
              <div className="flex-1 min-w-0">
                <Skeleton className="h-4 w-48 mb-2" />
                <Skeleton className="h-3 w-32" />
              </div>
              <Skeleton className="h-6 w-20 shrink-0" />
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
