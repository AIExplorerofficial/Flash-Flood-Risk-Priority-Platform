interface Props {
  rows?: number
  cols?: number
  className?: string
}

export function Skeleton({ rows = 1, cols = 1, className = '' }: Props) {
  return (
    <div className={`space-y-2 ${className}`} aria-busy="true" aria-label="Loading…">
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} className="flex gap-2">
          {Array.from({ length: cols }).map((_, c) => (
            <div
              key={c}
              className="h-4 bg-gray-200 rounded animate-pulse flex-1"
            />
          ))}
        </div>
      ))}
    </div>
  )
}

export function SkeletonCard({ className = '' }: { className?: string }) {
  return (
    <div className={`bg-white rounded-lg border border-gray-200 p-4 space-y-3 ${className}`} aria-busy="true">
      <div className="h-3 bg-gray-200 rounded w-1/3 animate-pulse" />
      <div className="h-7 bg-gray-200 rounded w-2/3 animate-pulse" />
      <div className="h-3 bg-gray-200 rounded w-1/2 animate-pulse" />
    </div>
  )
}
