import { priorityColor, priorityPillClass } from '../utils/format'

interface Props {
  priority: string
}

export function PriorityPill({ priority }: Props) {
  return (
    <span className={priorityPillClass(priority)} style={{ borderLeft: `3px solid ${priorityColor(priority)}` }}>
      {priority}
    </span>
  )
}

interface DotProps {
  priority: string
  size?: number
}

export function PriorityDot({ priority, size = 10 }: DotProps) {
  return (
    <span
      className="inline-block rounded-full flex-shrink-0"
      style={{
        width: size,
        height: size,
        backgroundColor: priorityColor(priority),
      }}
      aria-label={priority}
    />
  )
}
