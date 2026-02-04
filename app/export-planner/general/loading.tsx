import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function GeneralPlannerLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center justify-between mb-8">
        <div>
          <Skeleton className="h-8 w-48 mb-2" />
          <Skeleton className="h-4 w-80" />
        </div>
        <Skeleton className="h-10 w-32" />
      </div>
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Card key={i} className="overflow-hidden">
            <Skeleton className="h-1.5 w-full" />
            <div className="p-5">
              <Skeleton className="h-5 w-3/4 mb-2" />
              <Skeleton className="h-4 w-1/2 mb-4" />
              <Skeleton className="h-9 w-full" />
            </div>
          </Card>
        ))}
      </div>
    </div>
  );
}
