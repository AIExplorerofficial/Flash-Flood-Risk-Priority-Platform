import { useQuery } from '@tanstack/react-query'
import { useState, useEffect, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { X, Plus, Eye, EyeOff, Download, Search } from 'lucide-react'
import {
  RadarChart, Radar, PolarGrid, PolarAngleAxis, ResponsiveContainer, Tooltip,
} from 'recharts'
import { api } from '../api/client'
import FloodMap, { type MapLayer } from '../components/FloodMap'
import MapLegend from '../components/MapLegend'
import { PriorityPill } from '../components/PriorityPill'
import { Skeleton } from '../components/Skeleton'
import { EmptyState, ErrorState } from '../components/EmptyState'
import { formatNumber, formatPop, formatMm, formatArea, priorityColor } from '../utils/format'
import type { CatchmentDetail } from '../api/types'

type LayerOption = { value: MapLayer; label: string }

const LAYER_OPTIONS: LayerOption[] = [
  { value: 'priority', label: 'Priority class' },
  { value: 'regime', label: 'Regime' },
  { value: 'priority_score', label: 'Priority score' },
  { value: 'exposure_index', label: 'Exposure index' },
  { value: 'hazard_index', label: 'Hazard index' },
  { value: 'elev_mean', label: 'Mean elevation' },
  { value: 'slope_p90', label: 'Slope p90' },
  { value: 'pop_total', label: 'Population' },
  { value: 'watch_mm', label: 'Watch rainfall level' },
]

const MAX_COMPARE = 4

export default function MapExplorer() {
  const [params, setParams] = useSearchParams()

  const searchParam = params.get('search') ?? ''
  const regimeFilter = params.get('regime') ?? ''
  const priorityFilter = params.get('priority') ?? ''
  const elevMin = params.get('elev_min') ?? ''
  const elevMax = params.get('elev_max') ?? ''
  const popMin = params.get('pop_min') ?? ''
  const cascadeParam = params.get('cascade') ?? ''

  const [layer, setLayer] = useState<MapLayer>('priority')
  const [showEvents, setShowEvents] = useState(false)

  const parsedSearchId = searchParam ? parseInt(searchParam, 10) : null
  const initialSelectedId = parsedSearchId && !isNaN(parsedSearchId) ? parsedSearchId : null

  const [drawerOpen, setDrawerOpen] = useState(initialSelectedId !== null)
  const [selectedId, setSelectedId] = useState<number | null>(initialSelectedId)
  const [compareIds, setCompareIds] = useState<number[]>([])
  const [compareOpen, setCompareOpen] = useState(false)
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | undefined>()

  const hasFilters = Boolean(regimeFilter || priorityFilter || elevMin || elevMax || popMin || cascadeParam || searchParam)

  // Fetch filter results and matching IDs from backend source of truth
  const { data: filterResults, isLoading: fLoading } = useQuery({
    queryKey: ['catchments-filter', regimeFilter, priorityFilter, elevMin, elevMax, popMin, cascadeParam, searchParam],
    queryFn: () =>
      api.catchments({
        regime: regimeFilter || undefined,
        priority: priorityFilter || undefined,
        elev_min: elevMin ? Number(elevMin) : undefined,
        elev_max: elevMax ? Number(elevMax) : undefined,
        pop_min: popMin ? Number(popMin) : undefined,
        cascade: cascadeParam === 'true' ? true : undefined,
        search: searchParam || undefined,
        page_size: 200,
      }),
  })

  const matchingIds = useMemo(() => {
    if (!hasFilters) return null
    if (!filterResults?.matching_ids) return null
    return new Set(filterResults.matching_ids)
  }, [hasFilters, filterResults])

  const { data: events } = useQuery({ queryKey: ['events'], queryFn: api.events })

  const { data: detail, isLoading: dLoading, error: dError } = useQuery({
    queryKey: ['catchment', selectedId],
    queryFn: () => api.catchment(selectedId!),
    enabled: selectedId !== null,
  })

  // When a valid catchment detail is retrieved, center and zoom to it
  useEffect(() => {
    if (detail) {
      const timer = setTimeout(() => {
        setFlyTo({ lng: detail.lon, lat: detail.lat, zoom: 11 })
      }, 0)
      return () => clearTimeout(timer)
    }
  }, [detail])

  const compare0 = useQuery({ queryKey: ['catchment', compareIds[0]], queryFn: () => api.catchment(compareIds[0]!), enabled: compareIds.length > 0 })
  const compare1 = useQuery({ queryKey: ['catchment', compareIds[1]], queryFn: () => api.catchment(compareIds[1]!), enabled: compareIds.length > 1 })
  const compare2 = useQuery({ queryKey: ['catchment', compareIds[2]], queryFn: () => api.catchment(compareIds[2]!), enabled: compareIds.length > 2 })
  const compare3 = useQuery({ queryKey: ['catchment', compareIds[3]], queryFn: () => api.catchment(compareIds[3]!), enabled: compareIds.length > 3 })
  const compareQueries = [
    { id: compareIds[0], detail: compare0.data },
    { id: compareIds[1], detail: compare1.data },
    { id: compareIds[2], detail: compare2.data },
    { id: compareIds[3], detail: compare3.data },
  ].slice(0, compareIds.length)

  useEffect(() => {
    if (searchParam) {
      const id = parseInt(searchParam, 10)
      if (!isNaN(id)) {
        const timer = setTimeout(() => {
          setSelectedId(prev => (prev !== id ? id : prev))
          setDrawerOpen(true)
        }, 0)
        return () => clearTimeout(timer)
      }
    }
  }, [searchParam])

  function updateParam(key: string, value: string) {
    setParams(prev => {
      const next = new URLSearchParams(prev)
      if (value) next.set(key, value)
      else next.delete(key)
      return next
    })
  }

  function clearFilters() {
    setParams({})
  }

  function handleCatchmentClick(id: number, lngLat: { lng: number; lat: number }) {
    setSelectedId(id)
    setDrawerOpen(true)
    setFlyTo({ lng: lngLat.lng, lat: lngLat.lat, zoom: 11 })
  }

  function addToCompare(id: number) {
    if (compareIds.includes(id) || compareIds.length >= MAX_COMPARE) return
    setCompareIds(prev => [...prev, id])
  }

  function removeFromCompare(id: number) {
    setCompareIds(prev => prev.filter(i => i !== id))
  }

  function exportBrief(d: CatchmentDetail) {
    const lines = [
      `Catchment ${d.catchment_id}`,
      `Regime: ${d.regime}`,
      `Priority: ${d.priority}`,
      `Priority score: ${d.priority_score.toFixed(4)}`,
      `Hazard index: ${d.hazard_index.toFixed(4)}`,
      `Exposure index: ${d.exposure_index.toFixed(4)}`,
      `Population: ${formatPop(d.pop_total)}`,
      `Near-channel pop: ${formatPop(d.pop_near_channel)}`,
      `Elevation: ${formatNumber(d.elev_mean, 0)} m`,
      `Slope p90: ${d.slope_p90.toFixed(1)}°`,
      `Watch level: ${formatMm(d.watch_mm)}`,
      `Warning level: ${formatMm(d.warn_mm)}`,
      `Action: ${d.action}`,
    ]
    const blob = new Blob([lines.join('\n')], { type: 'text/plain' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `catchment_${d.catchment_id}_brief.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  const activeFiltersStr = [
    searchParam && `Search: ${searchParam}`,
    regimeFilter && `Regime: ${regimeFilter}`,
    priorityFilter && `Priority: ${priorityFilter}`,
    elevMin && `Elev ≥ ${elevMin} m`,
    elevMax && `Elev ≤ ${elevMax} m`,
    popMin && `Pop ≥ ${popMin}`,
    cascadeParam && `Cascade: ${cascadeParam}`,
  ].filter(Boolean).join(', ')

  const eventPoints = showEvents ? (events?.events_all ?? []) : undefined

  return (
    <div className="flex h-full relative">
      {/* Filter sidebar */}
      <div className="w-60 bg-white border-r border-gray-200 flex flex-col overflow-y-auto flex-shrink-0">
        {/* Layer selector */}
        <div className="p-3 border-b border-gray-100">
          <div className="text-xs font-semibold text-gray-700 mb-1.5">Layer</div>
          <select
            value={layer}
            onChange={e => setLayer(e.target.value as MapLayer)}
            className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
            aria-label="Map layer"
          >
            {LAYER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>

        {/* Catchment Count Counter */}
        <div className="px-3 py-2 bg-gray-50 border-b border-gray-100 flex items-center justify-between text-xs">
          <span className="text-gray-500">Matching Catchments</span>
          <span className="font-semibold text-gray-900 tabular-nums">
            {fLoading ? '…' : formatNumber(hasFilters ? (filterResults?.total ?? 0) : 3067)} / 3,067
          </span>
        </div>

        <div className="p-3 space-y-3.5">
          {/* Catchment ID Search */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Catchment ID Search</div>
            <div className="relative">
              <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <input
                type="search"
                placeholder="Search ID (e.g. 1847)…"
                value={searchParam}
                onChange={e => updateParam('search', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded pl-7 pr-7 py-1.5 bg-white focus:border-accent"
                aria-label="Filter by catchment ID"
              />
              {searchParam && (
                <button
                  onClick={() => updateParam('search', '')}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                  aria-label="Clear search"
                >
                  <X size={12} />
                </button>
              )}
            </div>
            {searchParam && filterResults && (
              <div className="text-[11px] text-gray-500 mt-1">
                {filterResults.total === 0 ? (
                  <span className="text-red-600">No match found</span>
                ) : filterResults.total === 1 ? (
                  <span className="text-green-700 font-medium">1 exact match found</span>
                ) : (
                  <span>{filterResults.total} catchments match</span>
                )}
              </div>
            )}
          </div>

          {/* Regime Filter */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Regime</div>
            <select
              value={regimeFilter}
              onChange={e => updateParam('regime', e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
              aria-label="Filter by regime"
            >
              <option value="">All regimes</option>
              {['R1', 'R2', 'R3', 'R4', 'R5'].map(r => (
                <option key={r} value={r}>{r}</option>
              ))}
            </select>
          </div>

          {/* Priority Filter */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Priority class</div>
            {['P1 Critical', 'P2 High', 'P3 Watch', 'P4 Routine'].map(p => (
              <label key={p} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
                <input
                  type="radio"
                  name="priority"
                  value={p}
                  checked={priorityFilter === p}
                  onChange={e => updateParam('priority', e.target.value)}
                  className="text-accent"
                />
                <span
                  className="w-2.5 h-2.5 rounded-sm flex-shrink-0"
                  style={{ backgroundColor: priorityColor(p) }}
                />
                {p}
              </label>
            ))}
            {priorityFilter && (
              <button
                onClick={() => updateParam('priority', '')}
                className="text-xs text-gray-400 hover:text-gray-600 mt-1"
              >
                Clear priority filter
              </button>
            )}
          </div>

          {/* Elevation Range */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Elevation range (m)</div>
            <div className="flex gap-1.5">
              <input
                type="number"
                placeholder="Min (500)"
                value={elevMin}
                onChange={e => updateParam('elev_min', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                aria-label="Min elevation"
              />
              <input
                type="number"
                placeholder="Max (5500)"
                value={elevMax}
                onChange={e => updateParam('elev_max', e.target.value)}
                className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
                aria-label="Max elevation"
              />
            </div>
          </div>

          {/* Min Population */}
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Min population</div>
            <input
              type="number"
              placeholder="0"
              value={popMin}
              onChange={e => updateParam('pop_min', e.target.value)}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1 bg-white"
              aria-label="Minimum population"
            />
          </div>

          {/* Cascade Risk Toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={cascadeParam === 'true'}
                onChange={e => updateParam('cascade', e.target.checked ? 'true' : '')}
                className="text-accent"
              />
              Cascade watch only
            </label>
          </div>

          {/* Recorded Flood Events Toggle */}
          <div>
            <label className="flex items-center gap-2 text-xs cursor-pointer">
              <input
                type="checkbox"
                checked={showEvents}
                onChange={e => setShowEvents(e.target.checked)}
                className="text-accent"
              />
              {showEvents ? <Eye size={12} /> : <EyeOff size={12} />}
              Show event points (122)
            </label>
            {showEvents && (
              <div className="mt-1.5 ml-4 text-xs text-gray-500 space-y-1">
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-blue-700 inline-block" /> Town precision (40)
                </div>
                <div className="flex items-center gap-1.5">
                  <span className="w-2.5 h-2.5 rounded-full bg-amber-500 inline-block" /> Approximate (82)
                </div>
              </div>
            )}
          </div>

          {hasFilters && (
            <button
              onClick={clearFilters}
              className="btn-secondary w-full text-xs text-accent border-blue-200 hover:bg-blue-50 py-1.5"
            >
              Clear all filters
            </button>
          )}
        </div>
      </div>

      {/* Map area */}
      <div className="flex-1 relative">
        <FloodMap
          layer={layer}
          onCatchmentClick={handleCatchmentClick}
          selectedId={selectedId}
          matchingIds={matchingIds}
          events={eventPoints}
          showEvents={showEvents}
          flyTo={flyTo}
          className="absolute inset-0"
        />

        <div className="absolute bottom-3 left-3 z-10">
          <MapLegend layer={layer} />
        </div>

        {/* No Results Floating Notification */}
        {hasFilters && filterResults?.total === 0 && !fLoading && (
          <div className="absolute top-4 left-1/2 -translate-x-1/2 z-20 bg-white border border-gray-200 rounded-lg shadow-lg px-4 py-3 flex items-center gap-3">
            <span className="text-xs text-gray-700">No catchments match the current filters.</span>
            <button onClick={clearFilters} className="btn-primary text-xs py-1 px-2.5">
              Reset filters
            </button>
          </div>
        )}

        {/* Compare bar */}
        {compareIds.length > 0 && (
          <div className="absolute top-3 left-1/2 -translate-x-1/2 z-10 bg-white border border-gray-200 rounded-lg shadow-sm px-3 py-2 flex items-center gap-2">
            <span className="text-xs font-medium text-gray-700">Comparing:</span>
            {compareIds.map(id => (
              <span key={id} className="inline-flex items-center gap-1 bg-blue-50 text-accent text-xs px-2 py-0.5 rounded">
                #{id}
                <button onClick={() => removeFromCompare(id)} aria-label={`Remove ${id} from compare`}>
                  <X size={10} />
                </button>
              </span>
            ))}
            <button
              onClick={() => setCompareOpen(true)}
              className="text-xs btn-primary py-1 px-2"
            >
              Compare
            </button>
          </div>
        )}
      </div>

      {/* Detail drawer */}
      {drawerOpen && (
        <div className="w-80 bg-white border-l border-gray-200 flex flex-col overflow-hidden flex-shrink-0 z-10">
          <div className="flex items-center justify-between p-3 border-b border-gray-100">
            <div className="text-sm font-semibold text-gray-900">
              {selectedId !== null ? `Catchment #${selectedId}` : 'Catchment Detail'}
            </div>
            <button
              onClick={() => setDrawerOpen(false)}
              aria-label="Close drawer"
              className="text-gray-400 hover:text-gray-700 p-1 rounded"
            >
              <X size={16} />
            </button>
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-4">
            {dLoading && <Skeleton rows={8} />}
            {dError && <ErrorState message="Failed to load catchment detail." />}
            {detail && (
              <>
                {/* Identity */}
                <div>
                  <PriorityPill priority={detail.priority} />
                  <div className="mt-2 text-xs text-gray-600 space-y-0.5">
                    <div>Regime: <span className="font-medium text-gray-800">{detail.regime}</span></div>
                    <div>Confidence: <span className="font-medium">{(detail.conf * 100).toFixed(0)}%</span>
                      {detail.borderline && <span className="ml-1 text-amber-600 text-xs">(borderline)</span>}
                    </div>
                    <div>Cascade risk: <span className="font-medium">{detail.cascade_risk}</span></div>
                    <div>Area: <span className="font-medium">{formatArea(detail.area_km2)}</span></div>
                  </div>
                </div>

                {/* Scores */}
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { label: 'Hazard', value: detail.hazard_index.toFixed(3) },
                    { label: 'Exposure', value: detail.exposure_index.toFixed(3) },
                    { label: 'Score', value: detail.priority_score.toFixed(3) },
                  ].map(s => (
                    <div key={s.label} className="bg-gray-50 rounded p-2 text-center">
                      <div className="text-xs text-gray-500">{s.label}</div>
                      <div className="text-sm font-semibold text-gray-900">{s.value}</div>
                    </div>
                  ))}
                </div>

                {/* Population */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Population</div>
                  <div className="text-xs space-y-0.5 text-gray-600">
                    <div>Total: <span className="font-medium">{formatPop(detail.pop_total)}</span></div>
                    <div>Near channel: <span className="font-medium">{formatPop(detail.pop_near_channel)}</span></div>
                  </div>
                </div>

                {/* Terrain */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Terrain</div>
                  <div className="text-xs space-y-0.5 text-gray-600">
                    <div>Elevation: <span className="font-medium">{formatNumber(detail.elev_mean, 0)} m</span></div>
                    <div>Slope p90: <span className="font-medium">{detail.slope_p90.toFixed(1)}°</span></div>
                    <div>Melton: <span className="font-medium">{detail.melton.toFixed(3)}</span></div>
                  </div>
                </div>

                {/* Rainfall */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Rainfall</div>
                  <div className="text-xs space-y-0.5 text-gray-600">
                    <div>p99 wet day: <span className="font-medium">{detail.p99_wetday.toFixed(1)} mm/d</span></div>
                    <div>Max 3-day: <span className="font-medium">{detail.max3d.toFixed(1)} mm</span></div>
                    <div>Heavy days/yr: <span className="font-medium">{detail.heavy_days.toFixed(1)}</span></div>
                  </div>
                </div>

                {/* Alert levels */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Alert Levels</div>
                  <div className="text-xs space-y-0.5 text-gray-600">
                    <div>Watch: <span className="font-medium">{formatMm(detail.watch_mm)}</span>
                      <span className="text-gray-400 ml-1">({detail.watch_days_yr.toFixed(1)} d/yr)</span></div>
                    <div>Warning: <span className="font-medium">{formatMm(detail.warn_mm)}</span>
                      <span className="text-gray-400 ml-1">({detail.warn_days_yr.toFixed(1)} d/yr)</span></div>
                    <div>IMD orange: <span className="font-medium">{detail.imd_orange_days_yr.toFixed(2)} d/yr</span></div>
                  </div>
                </div>

                {/* Percentile bars */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-2">Feature Percentiles</div>
                  <div className="space-y-1.5">
                    {detail.feature_percentiles.map(fp => (
                      <div key={fp.name}>
                        <div className="flex justify-between text-xs text-gray-500 mb-0.5">
                          <span>{fp.name}</span>
                          <span>{(fp.percentile * 100).toFixed(0)}th pct</span>
                        </div>
                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                          <div
                            className="h-full bg-accent rounded-full"
                            style={{ width: `${fp.percentile * 100}%` }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Action */}
                <div>
                  <div className="text-xs font-semibold text-gray-700 mb-1">Recommended Action</div>
                  <div className="text-xs text-gray-800 bg-blue-50 border border-blue-100 rounded p-2">
                    {detail.action}
                  </div>
                </div>

                {/* Similar catchments */}
                {detail.similar_catchments.length > 0 && (
                  <div>
                    <div className="text-xs font-semibold text-gray-700 mb-1">Similar Catchments</div>
                    <div className="space-y-1">
                      {detail.similar_catchments.map(s => (
                        <button
                          key={s.catchment_id}
                          onClick={() => {
                            setSelectedId(s.catchment_id)
                            updateParam('search', String(s.catchment_id))
                          }}
                          className="w-full text-left text-xs py-1 px-2 rounded hover:bg-gray-50 border border-gray-100 flex justify-between"
                        >
                          <span className="text-accent font-medium">#{s.catchment_id}</span>
                          <span className="text-gray-500">{s.priority.split(' ')[0]}</span>
                          <span className="text-gray-400">{s.priority_score.toFixed(3)}</span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div className="flex gap-2 pt-2 border-t border-gray-100">
                  <button
                    onClick={() => addToCompare(detail.catchment_id)}
                    disabled={compareIds.includes(detail.catchment_id) || compareIds.length >= MAX_COMPARE}
                    className="btn-secondary text-xs flex items-center gap-1 flex-1 justify-center"
                  >
                    <Plus size={12} /> Compare
                  </button>
                  <button
                    onClick={() => exportBrief(detail)}
                    className="btn-secondary text-xs flex items-center gap-1 flex-1 justify-center"
                  >
                    <Download size={12} /> Brief
                  </button>
                </div>
              </>
            )}
            {!selectedId && (
              <EmptyState
                message="Click a catchment on the map or enter an ID to view details."
                filters={hasFilters ? activeFiltersStr : undefined}
                onClear={hasFilters ? clearFilters : undefined}
              />
            )}
          </div>
        </div>
      )}

      {/* Compare modal */}
      {compareOpen && compareIds.length > 0 && (
        <div
          className="absolute inset-0 bg-black/40 z-30 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Compare catchments"
        >
          <div className="bg-white rounded-xl shadow-xl w-11/12 max-w-5xl max-h-[85vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Catchment Comparison</h2>
              <button
                onClick={() => setCompareOpen(false)}
                aria-label="Close compare"
                className="text-gray-400 hover:text-gray-700 p-1"
              >
                <X size={18} />
              </button>
            </div>

            <div className="grid gap-4" style={{ gridTemplateColumns: `repeat(${compareIds.length}, 1fr)` }}>
              {compareQueries.map(({ id, detail: d }) => (
                <div key={id} className="border border-gray-200 rounded-lg p-3">
                  <div className="text-sm font-semibold text-gray-900 mb-2">#{id}</div>
                  {!d ? (
                    <Skeleton rows={6} />
                  ) : (
                    <div className="text-xs space-y-1 text-gray-700">
                      <div><span className="text-gray-500">Priority:</span> {d.priority}</div>
                      <div><span className="text-gray-500">Regime:</span> {d.regime.split(' ')[0]}</div>
                      <div><span className="text-gray-500">Score:</span> {d.priority_score.toFixed(4)}</div>
                      <div><span className="text-gray-500">Hazard:</span> {d.hazard_index.toFixed(4)}</div>
                      <div><span className="text-gray-500">Exposure:</span> {d.exposure_index.toFixed(4)}</div>
                      <div><span className="text-gray-500">Population:</span> {formatPop(d.pop_total)}</div>
                      <div><span className="text-gray-500">Elevation:</span> {formatNumber(d.elev_mean, 0)} m</div>
                      <div><span className="text-gray-500">Watch:</span> {formatMm(d.watch_mm)}</div>
                    </div>
                  )}
                </div>
              ))}
            </div>

            {/* Radar chart */}
            {compareQueries.every(q => q.detail) && (
              <div className="mt-4">
                <div className="text-xs font-semibold text-gray-700 mb-2">Feature Radar (percentiles)</div>
                <ResponsiveContainer width="100%" height={260}>
                  <RadarChart data={['hazard_index', 'exposure_index', 'priority_score', 'slope_p90', 'p99_wetday', 'pop_total'].map(feat => {
                    const entry: Record<string, number | string> = { feature: feat }
                    compareQueries.forEach(({ id, detail: d }) => {
                      const fp = d?.feature_percentiles.find(f => f.name === feat || f.name === feat.replace('_', ' '))
                      entry[`#${id}`] = fp ? fp.percentile * 100 : 0
                    })
                    return entry
                  })}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="feature" tick={{ fontSize: 10 }} />
                    {compareIds.map((id, i) => (
                      <Radar
                        key={id}
                        name={`#${id}`}
                        dataKey={`#${id}`}
                        stroke={['#2563EB', '#DC2626', '#D97706', '#059669'][i]}
                        fill={['#2563EB', '#DC2626', '#D97706', '#059669'][i]}
                        fillOpacity={0.1}
                        strokeWidth={1.5}
                      />
                    ))}
                    <Tooltip contentStyle={{ fontSize: 11 }} />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
