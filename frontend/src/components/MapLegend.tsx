import { PRIORITY_COLORS, REGIME_COLORS } from '../utils/format'
import type { MapLayer } from './FloodMap'

interface Props {
  layer: MapLayer
}

const PRIORITY_LABELS = [
  { key: 'P1 Critical', label: 'P1 Critical' },
  { key: 'P2 High', label: 'P2 High' },
  { key: 'P3 Watch', label: 'P3 Watch' },
  { key: 'P4 Routine', label: 'P4 Routine' },
]

const REGIME_LABELS = [
  { key: 'R1', label: 'R1 Alpine very steep' },
  { key: 'R2', label: 'R2 Alpine steep' },
  { key: 'R3', label: 'R3 Mid-hill high rain' },
  { key: 'R4', label: 'R4 Mid-hill mod. rain' },
  { key: 'R5', label: 'R5 Alpine mod. rain' },
]

const CONTINUOUS_CONFIGS: Partial<Record<MapLayer, { stops: [number, string][]; unit: string }>> = {
  priority_score: { stops: [[0, '#FFF7ED'], [0.5, '#EA580C'], [1, '#7C2D12']], unit: '0–1' },
  exposure_index: { stops: [[0, '#FFF7ED'], [0.5, '#EA580C'], [1, '#7C2D12']], unit: '0–1' },
  hazard_index: { stops: [[0, '#FFF7ED'], [0.5, '#EA580C'], [1, '#7C2D12']], unit: '0–1' },
  elev_mean: { stops: [[500, '#E0F2FE'], [2000, '#7DD3FC'], [4000, '#0369A1'], [5500, '#1E3A5F']], unit: 'm' },
  slope_p90: { stops: [[0, '#FFF7ED'], [25, '#FED7AA'], [50, '#7C2D12']], unit: 'deg' },
  pop_total: { stops: [[0, '#F0FDF4'], [5000, '#86EFAC'], [50000, '#16A34A'], [300000, '#14532D']], unit: 'people' },
  watch_mm: { stops: [[20, '#E0F2FE'], [50, '#0369A1'], [80, '#1E3A5F']], unit: 'mm/d' },
}

export default function MapLegend({ layer }: Props) {
  if (layer === 'priority') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <div className="text-xs font-semibold text-gray-700 mb-2">Priority Class</div>
        {PRIORITY_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: PRIORITY_COLORS[key] }} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    )
  }

  if (layer === 'regime') {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
        <div className="text-xs font-semibold text-gray-700 mb-2">Terrain–Rainfall Regime</div>
        {REGIME_LABELS.map(({ key, label }) => (
          <div key={key} className="flex items-center gap-2 mb-1">
            <span className="w-3 h-3 rounded-sm flex-shrink-0" style={{ backgroundColor: REGIME_COLORS[key] }} />
            <span className="text-xs text-gray-600">{label}</span>
          </div>
        ))}
      </div>
    )
  }

  const cfg = CONTINUOUS_CONFIGS[layer]
  if (!cfg) return null

  const gradient = `linear-gradient(to right, ${cfg.stops.map(([, c]) => c).join(', ')})`

  return (
    <div className="bg-white rounded-lg border border-gray-200 p-3 shadow-sm">
      <div className="text-xs font-semibold text-gray-700 mb-2 capitalize">
        {layer.replace(/_/g, ' ')}
      </div>
      <div className="h-3 rounded" style={{ background: gradient }} />
      <div className="flex justify-between mt-1">
        <span className="text-xs text-gray-500">{cfg.stops[0][0]} {cfg.unit}</span>
        <span className="text-xs text-gray-500">{cfg.stops[cfg.stops.length - 1][0]} {cfg.unit}</span>
      </div>
    </div>
  )
}
