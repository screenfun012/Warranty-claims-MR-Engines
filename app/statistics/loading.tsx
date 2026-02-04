import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function StatisticsLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-48" />
      <Card className="p-6">
        <Skeleton className="h-80 w-full rounded" />
      </Card>
    </div>
  );
}
