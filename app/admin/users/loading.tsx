import { Skeleton } from "@/components/ui/skeleton";
import { Card } from "@/components/ui/card";

export default function AdminUsersLoading() {
  return (
    <div className="p-6 space-y-6">
      <Skeleton className="h-8 w-40" />
      <Card className="p-4">
        <div className="space-y-3">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-12 w-full rounded-md" />
          ))}
        </div>
      </Card>
    </div>
  );
}
