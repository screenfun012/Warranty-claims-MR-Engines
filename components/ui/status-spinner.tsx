import { cn } from "@/lib/utils";

interface StatusSpinnerProps {
  className?: string;
  color?: "amber" | "yellow";
}

export function StatusSpinner({ className, color = "amber" }: StatusSpinnerProps) {
  const colorClasses = {
    amber: "bg-amber-500 dark:bg-amber-400",
    yellow: "bg-yellow-500 dark:bg-yellow-400",
  };

  return (
    <div className={cn("inline-flex items-center gap-0.5", className)}>
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          colorClasses[color],
          "animate-pulse"
        )}
        style={{ animationDelay: "0ms", animationDuration: "1.4s" }}
      />
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          colorClasses[color],
          "animate-pulse"
        )}
        style={{ animationDelay: "200ms", animationDuration: "1.4s" }}
      />
      <div
        className={cn(
          "h-1.5 w-1.5 rounded-full",
          colorClasses[color],
          "animate-pulse"
        )}
        style={{ animationDelay: "400ms", animationDuration: "1.4s" }}
      />
    </div>
  );
}

