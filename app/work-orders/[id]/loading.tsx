import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function WorkOrderDetailLoading() {
  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center gap-4">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1">
          <Skeleton className="h-6 w-56 mb-2" />
          <Skeleton className="h-4 w-40" />
        </div>
      </div>
      <Card className="p-6 space-y-4">
        {[...Array(6)].map((_, i) => (
          <Skeleton key={i} className="h-4 w-full" />
        ))}
      </Card>
    </div>
  );
}
