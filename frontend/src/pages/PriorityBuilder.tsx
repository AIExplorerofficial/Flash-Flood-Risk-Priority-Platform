import { useState, useCallback, useRef, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { RotateCcw, Loader2 } from 'lucide-react'
import type { LngLat } from 'maplibre-gl'
import { api } from '../api/client'
import FloodMap from '../components/FloodMap'
import MapLegend from '../components/MapLegend'
import { PriorityPill } from '../components/PriorityPill'
import { formatNumber, formatPop, PRIORITY_COLORS, PRIORITY_ORDER, DEFAULT_RANK_WEIGHTS } from '../utils/format'
import type { CatchmentRow, RankRequest } from '../api/types'

interface SliderProps {
  label: string
  value: number
  min: number
  max: number
  step: number
  unit?: string
  onChange: (v: number) => void
}

function WeightSlider({ label, value, min, max, step, unit = '', onChange }: SliderProps) {
  return (
    <div className="mb-3">
      <div className="flex justify-between text-xs text-gray-600 mb-1">
        <span>{label}</span>
        <span className="font-medium tabular-nums">{value.toFixed(step < 0.1 ? 2 : 1)}{unit}</span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-xs text-gray-400 w-6 text-right">{min}</span>
        <input
          type="range"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={e => onChange(parseFloat(e.target.value))}
          className="flex-1 h-1.5 rounded accent-accent"
          aria-label={label}
        />
        <span className="text-xs text-gray-400 w-10">{max}{unit}</span>
      </div>
    </div>
  )
}

type Weights = Required<RankRequest>

const INITIAL_WEIGHTS: Weights = { ...DEFAULT_RANK_WEIGHTS, top_n: 20 } as Weights

export default function PriorityBuilder() {
  const [weights, setWeights] = useState<Weights>(INITIAL_WEIGHTS)
  const [debouncedWeights, setDebouncedWeights] = useState<Weights>(INITIAL_WEIGHTS)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | undefined>(undefined)

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Use TanStack Query with debouncedWeights:
  // 1. Initial query runs automatically on mount with default weights
  // 2. Rapid slider adjustments debounce before querying
  // 3. Out-of-order / stale responses are automatically prevented by React Query
  const { data: result, isFetching: isComputing } = useQuery({
    queryKey: ['rank', debouncedWeights],
    queryFn: () => api.rank(debouncedWeights),
  })

  const triggerDebounce = useCallback((next: Weights) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      setDebouncedWeights(next)
    }, 250)
  }, [])

  function updateWeight(key: keyof Weights, value: number) {
    const next = { ...weights, [key]: value }
    setWeights(next)
    triggerDebounce(next)
  }

  function resetToDefault() {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const next = { ...DEFAULT_RANK_WEIGHTS, top_n: 20 } as Weights
    setWeights(next)
    setDebouncedWeights(next)
    setSelectedId(null)
    setFlyTo(undefined)
  }

  // Synchronize dynamic classifications with GeoJSON features on the map
  const dynamicPriorities = useMemo<Record<number, string> | null>(() => {
    if (!result?.catchment_classes || result.catchment_classes.length === 0) return null
    const map: Record<number, string> = {}
    for (const c of result.catchment_classes) {
      map[c.catchment_id] = c.priority
    }
    return map
  }, [result])

  const changedMap = useMemo(() => {
    const m = new Map<number, boolean>()
    if (result?.catchment_classes) {
      for (const cc of result.catchment_classes) {
        if (cc.changed) m.set(cc.catchment_id, true)
      }
    }
    return m
  }, [result])

  const priorityCounts = result?.priority_counts ?? {}
  const priorityBarData = PRIORITY_ORDER.map(p => ({
    name: p,
    value: priorityCounts[p] ?? 0,
    color: PRIORITY_COLORS[p],
  }))

  const rankChanges = result?.rank_changes ?? {}

  function handleSelectRow(c: CatchmentRow) {
    setSelectedId(c.catchment_id)
    if (c.lon && c.lat) {
      setFlyTo({ lng: c.lon, lat: c.lat, zoom: 11 })
    }
  }

  function handleMapClick(id: number, lngLat: LngLat) {
    setSelectedId(id)
    setFlyTo({ lng: lngLat.lng, lat: lngLat.lat, zoom: 11 })
  }

  return (
    <div className="flex h-full">
      {/* Controls panel */}
      <div className="w-72 bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
        <div className="p-4 border-b border-gray-100 flex items-center justify-between">
          <div>
            <div className="text-sm font-semibold text-gray-900">Priority Builder</div>
            <div className="text-xs text-gray-500">Adjust weights, re-rank all catchments</div>
          </div>
          <button
            onClick={resetToDefault}
            className="btn-secondary text-xs flex items-center gap-1 py-1"
            aria-label="Reset to default weights"
          >
            <RotateCcw size={12} /> Reset
          </button>
        </div>

        <div className="p-4 space-y-5 overflow-y-auto">
          {/* Response group */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Response Group Weights</div>
            <WeightSlider label="Slope p90" value={weights.weight_slope_p90} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_slope_p90', v)} />
            <WeightSlider label="Melton ruggedness" value={weights.weight_melton} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_melton', v)} />
            <WeightSlider label="Drainage density" value={weights.weight_drainage_density} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_drainage_density', v)} />
            <WeightSlider label="1/Tc (inverse)" value={weights.weight_inv_tc_min} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_inv_tc_min', v)} />
          </div>

          {/* Rainfall group */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Rainfall Group Weights</div>
            <WeightSlider label="p99 wet-day" value={weights.weight_p99_wetday} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_p99_wetday', v)} />
            <WeightSlider label="Max 3-day" value={weights.weight_max3d} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_max3d', v)} />
            <WeightSlider label="Heavy rain days" value={weights.weight_heavy_days} min={0} max={5} step={0.1} onChange={v => updateWeight('weight_heavy_days', v)} />
          </div>

          {/* Balance */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Group Balance</div>
            <WeightSlider
              label="Response ← → Rainfall"
              value={weights.response_rainfall_balance}
              min={0}
              max={1}
              step={0.05}
              onChange={v => updateWeight('response_rainfall_balance', v)}
            />
            <div className="flex justify-between text-xs text-gray-400 -mt-2">
              <span>All Rainfall</span>
              <span>50/50</span>
              <span>All Response</span>
            </div>
          </div>

          {/* Exposure */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Exposure</div>
            <WeightSlider label="Exposure weight" value={weights.exposure_weight} min={0} max={5} step={0.1} onChange={v => updateWeight('exposure_weight', v)} />
          </div>

          {/* Belt */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Populated Belt (m)</div>
            <WeightSlider label="Min elevation" value={weights.belt_min} min={200} max={2000} step={50} unit=" m" onChange={v => updateWeight('belt_min', v)} />
            <WeightSlider label="Max elevation" value={weights.belt_max} min={2000} max={5000} step={50} unit=" m" onChange={v => updateWeight('belt_max', v)} />
          </div>

          {/* Cutoffs */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-2 uppercase tracking-wide">Priority Cutoffs</div>
            <WeightSlider label="P1 top %" value={weights.p1_pct * 100} min={1} max={20} step={0.5} unit="%" onChange={v => updateWeight('p1_pct', v / 100)} />
            <WeightSlider label="P2 next %" value={weights.p2_pct * 100} min={1} max={20} step={0.5} unit="%" onChange={v => updateWeight('p2_pct', v / 100)} />
          </div>
        </div>

        {/* Status */}
        <div className="p-3 border-t border-gray-100 text-xs text-gray-500">
          {isComputing ? (
            <span className="flex items-center gap-1 text-accent">
              <Loader2 size={12} className="animate-spin" /> Computing ranking…
            </span>
          ) : result ? (
            <span>
              {formatNumber(result.rows_processed)} rows · {result.processing_time_ms.toFixed(0)} ms
            </span>
          ) : (
            <span>Adjust a slider to recompute</span>
          )}
        </div>
      </div>

      {/* Results area */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Stats row */}
        <div className="bg-white border-b border-gray-200 px-4 py-3 flex items-center gap-4 flex-shrink-0">
          <div className="flex gap-3">
            {PRIORITY_ORDER.map(p => (
              <div key={p} className="text-center">
                <div className="text-xs text-gray-500">{p.split(' ')[0]}</div>
                <div
                  className="text-lg font-semibold"
                  style={{ color: PRIORITY_COLORS[p] }}
                >
                  {formatNumber(priorityCounts[p] ?? 0)}
                </div>
              </div>
            ))}
          </div>
          <div className="border-l border-gray-200 pl-4">
            <div className="text-xs text-gray-500">P1+P2 population</div>
            <div className="text-base font-semibold text-gray-900">
              {result ? formatPop(result.population_p12) : '—'}
            </div>
          </div>
          {result && (
            <div className="border-l border-gray-200 pl-4 text-xs text-gray-500 space-y-0.5">
              <div>Upgraded: <span className="text-green-700 font-medium">{rankChanges.upgraded ?? 0}</span></div>
              <div>Downgraded: <span className="text-red-600 font-medium">{rankChanges.downgraded ?? 0}</span></div>
              <div>Unchanged: <span className="font-medium">{rankChanges.unchanged ?? 0}</span></div>
            </div>
          )}
        </div>

        <div className="flex-1 flex overflow-hidden">
          {/* Map synchronised with dynamic priorities */}
          <div className="flex-1 relative">
            <FloodMap
              layer="priority"
              dynamicPriorities={dynamicPriorities}
              selectedId={selectedId}
              flyTo={flyTo}
              onCatchmentClick={handleMapClick}
              className="absolute inset-0"
            />
            <div className="absolute bottom-3 left-3 z-10">
              <MapLegend layer="priority" />
            </div>
          </div>

          {/* Top N table */}
          <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100">
              <div className="text-xs font-semibold text-gray-700">Top {weights.top_n} Catchments</div>
            </div>
            <div className="flex-1 overflow-y-auto">
              {!result ? (
                <div className="p-4 text-xs text-gray-500">Computing initial ranking…</div>
              ) : (
                <table className="w-full text-xs">
                  <thead className="sticky top-0 bg-white border-b border-gray-100">
                    <tr>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">ID</th>
                      <th className="px-3 py-2 text-left text-gray-500 font-medium">Priority</th>
                      <th className="px-3 py-2 text-right text-gray-500 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.top_n.map((c, i) => {
                      const changed = changedMap.has(c.catchment_id)
                      const isSelected = selectedId === c.catchment_id
                      return (
                        <tr
                          key={c.catchment_id}
                          onClick={() => handleSelectRow(c)}
                          className={`border-b border-gray-50 cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50/80 font-medium' : 'hover:bg-gray-50'
                          }`}
                          title="Click to locate on map"
                        >
                          <td className="px-3 py-1.5 text-gray-700">
                            {i + 1}. #{c.catchment_id}
                            {changed && (
                              <span
                                className="ml-1 text-blue-600 font-bold"
                                title="Priority changed from baseline"
                              >
                                ↕
                              </span>
                            )}
                          </td>
                          <td className="px-3 py-1.5"><PriorityPill priority={c.priority} /></td>
                          <td className="px-3 py-1.5 text-right font-medium tabular-nums">
                            {c.priority_score.toFixed(4)}
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              )}
            </div>

            {/* Priority dist chart */}
            {result && (
              <div className="p-3 border-t border-gray-100">
                <div className="text-xs text-gray-500 mb-2">Priority distribution</div>
                <ResponsiveContainer width="100%" height={70}>
                  <BarChart data={priorityBarData} layout="vertical" margin={{ left: 0, right: 0 }}>
                    <XAxis type="number" tick={{ fontSize: 9 }} />
                    <YAxis type="category" dataKey="name" tick={{ fontSize: 9 }} width={22} />
                    <Tooltip formatter={(v) => [formatNumber(v as number), 'Catchments']} contentStyle={{ fontSize: 10 }} />
                    <Bar dataKey="value" radius={0}>
                      {priorityBarData.map((d, i) => <Cell key={i} fill={d.color} />)}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
