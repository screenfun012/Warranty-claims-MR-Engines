import { Skeleton } from "@/components/ui/skeleton";

export default function ExportBatchLoading() {
  return (
    <div className="p-6">
      <div className="flex items-center gap-4 mb-6">
        <Skeleton className="h-10 w-10 rounded" />
        <div className="flex-1">
          <Skeleton className="h-6 w-64 mb-2" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
      <div className="flex gap-4 overflow-hidden">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-96 min-w-[280px] rounded-lg" />
        ))}
      </div>
    </div>
  );
}
