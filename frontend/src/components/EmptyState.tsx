interface Props {
  message: string
  onClear?: () => void
  filters?: string
}

export function EmptyState({ message, onClear, filters }: Props) {
  return (
    <div className="flex flex-col items-center justify-center py-12 text-center">
      <div className="text-gray-400 text-sm">{message}</div>
      {filters && (
        <div className="mt-2 text-xs text-gray-400">
          Active filters: <span className="font-medium text-gray-600">{filters}</span>
        </div>
      )}
      {onClear && (
        <button
          onClick={onClear}
          className="mt-3 text-sm text-accent hover:underline"
        >
          Clear filters
        </button>
      )}
    </div>
  )
}

interface ErrorProps {
  message: string
}

export function ErrorState({ message }: ErrorProps) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="text-red-600 text-sm bg-red-50 border border-red-200 rounded-md px-4 py-3">
        {message}
      </div>
    </div>
  )
}
