import { cn } from "@/lib/utils"

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      className={cn("rounded-md", className)}
      style={{ animation: "dd-skeleton-shimmer 1.8s ease-in-out infinite" }}
    />
  )
}

export function FlightConfigSkeleton() {
  return (
    <div className="space-y-4 p-4">
      {[0, 1, 2].map((i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="h-3 w-24" />
          <Skeleton className="h-10 w-full" />
        </div>
      ))}
      <div className="grid grid-cols-2 gap-2">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-1.5">
            <Skeleton className="h-2.5 w-16" />
            <Skeleton className="h-8 w-full" />
          </div>
        ))}
      </div>
      <Skeleton className="h-10 w-full" />
    </div>
  )
}

export function ProjectListSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-3 p-4 sm:grid-cols-2">
      {Array.from({ length: 6 }).map((_, i) => (
        <div
          key={i}
          className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4"
        >
          <Skeleton className="h-4 w-3/4" />
          <Skeleton className="h-3 w-1/2" />
          <div className="flex items-center gap-2 pt-1">
            <Skeleton className="h-5 w-16 rounded-full" />
          </div>
        </div>
      ))}
    </div>
  )
}

export function ResultsPanelSkeleton() {
  return (
    <div className="space-y-3 p-4">
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
        <Skeleton className="h-4 w-24" />
        <Skeleton className="h-5 w-48" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <div className="space-y-2 rounded-xl border border-white/[0.06] bg-white/[0.03] p-4">
        <Skeleton className="h-3 w-20" />
        <div className="grid grid-cols-2 gap-2">
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-9 w-full rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  )
}
