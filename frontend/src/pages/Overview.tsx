import { useQuery } from '@tanstack/react-query'
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { PieChart, Pie } from 'recharts'
import { api } from '../api/client'
import FloodMap from '../components/FloodMap'
import MapLegend from '../components/MapLegend'
import { PriorityPill } from '../components/PriorityPill'
import { SkeletonCard, Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'
import {
  formatNumber, formatPop, PRIORITY_COLORS, PRIORITY_ORDER, regimeColor,
} from '../utils/format'

export default function Overview() {
  const navigate = useNavigate()
  const [flyTo, setFlyTo] = useState<{ lng: number; lat: number; zoom?: number } | undefined>()
  const [selectedId, setSelectedId] = useState<number | null>(null)

  const { data: summary, isLoading: sLoading, error: sError } = useQuery({
    queryKey: ['summary'],
    queryFn: api.summary,
  })

  const { data: frontendData, isLoading: fLoading } = useQuery({
    queryKey: ['frontend-data'],
    queryFn: api.frontendData,
  })

  const { data: events } = useQuery({
    queryKey: ['events'],
    queryFn: api.events,
  })

  function handleCatchmentClick(id: number) {
    setSelectedId(id)
    navigate(`/explorer?search=${id}`)
  }

  const priorityDonutData = summary
    ? PRIORITY_ORDER.map(p => ({
        name: p,
        value: summary.priority_counts[p] ?? 0,
        color: PRIORITY_COLORS[p],
      }))
    : []

  const regimeBarData = frontendData
    ? frontendData.regimes.map(r => ({
        name: r.regime.split(' ')[0],
        value: r.n,
        fill: regimeColor(r.regime),
      }))
    : []

  const eventsPerYear: Record<string, number> = {}
  if (events) {
    for (const ev of events.events_all) {
      const y = ev.date.slice(0, 4)
      eventsPerYear[y] = (eventsPerYear[y] ?? 0) + 1
    }
  }
  const eventsByYear = Object.entries(eventsPerYear)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([year, count]) => ({ year, count }))

  const top10 = frontendData?.top50?.slice(0, 10) ?? []

  if (sError) return <ErrorState message="Failed to load summary data." />

  return (
    <div className="p-4 space-y-4">
      {/* Page header */}
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Overview</h1>
        <p className="text-sm text-gray-500">Himalayan micro-catchment flash-flood priority triage · Uttarakhand + Himachal Pradesh</p>
      </div>

      {/* KPI tiles */}
      <div className="grid grid-cols-5 gap-3">
        {sLoading
          ? Array.from({ length: 5 }).map((_, i) => <SkeletonCard key={i} />)
          : [
              { label: 'Catchments analysed', value: formatNumber(summary?.n_catchments ?? 0), sub: 'micro-catchments' },
              { label: 'P1 + P2', value: formatNumber((summary?.priority_counts['P1 Critical'] ?? 0) + (summary?.priority_counts['P2 High'] ?? 0)), sub: 'critical + high' },
              { label: 'Population at risk', value: formatPop(summary?.population_p12 ?? 0), sub: 'in P1+P2 catchments' },
              { label: 'Cascade watch', value: formatNumber(summary?.n_cascade_watch ?? 0), sub: 'outside belt, High cascade' },
              { label: 'Recorded events', value: formatNumber(summary?.n_events_all ?? 0), sub: 'Uttarakhand 1970–2025' },
            ].map(kpi => (
              <div key={kpi.label} className="kpi-card">
                <div className="text-xs text-gray-500">{kpi.label}</div>
                <div className="text-2xl font-semibold text-gray-900 mt-1">{kpi.value}</div>
                <div className="text-xs text-gray-400 mt-0.5">{kpi.sub}</div>
              </div>
            ))}
      </div>

      {/* Map + right panel */}
      <div className="flex gap-4" style={{ height: 440 }}>
        {/* Map */}
        <div className="flex-1 relative rounded-lg overflow-hidden border border-gray-200 shadow-sm">
          <FloodMap
            layer="priority"
            selectedId={selectedId}
            onCatchmentClick={handleCatchmentClick}
            flyTo={flyTo}
            className="absolute inset-0"
          />
          <div className="absolute bottom-3 left-3 z-10">
            <MapLegend layer="priority" />
          </div>
        </div>

        {/* Right panel */}
        <div className="w-72 flex flex-col gap-3 overflow-y-auto">
          {/* Priority donut */}
          <div className="kpi-card">
            <div className="text-xs font-semibold text-gray-700 mb-2">Priority Distribution</div>
            {sLoading ? <Skeleton rows={4} /> : (
              <div className="flex items-center gap-2">
                <PieChart width={80} height={80}>
                  <Pie
                    data={priorityDonutData}
                    dataKey="value"
                    cx={40}
                    cy={40}
                    innerRadius={25}
                    outerRadius={38}
                    strokeWidth={0}
                  >
                    {priorityDonutData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
                <div className="space-y-1 flex-1">
                  {priorityDonutData.map(d => (
                    <div key={d.name} className="flex items-center justify-between text-xs">
                      <span className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: d.color }} />
                        {d.name.split(' ')[0]}
                      </span>
                      <span className="font-medium">{formatNumber(d.value)}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Regime bar */}
          <div className="kpi-card">
            <div className="text-xs font-semibold text-gray-700 mb-2">Catchments by Regime</div>
            {fLoading ? <Skeleton rows={5} /> : (
              <ResponsiveContainer width="100%" height={90}>
                <BarChart data={regimeBarData} layout="vertical" margin={{ left: 0, right: 8 }}>
                  <XAxis type="number" tick={{ fontSize: 10 }} />
                  <YAxis type="category" dataKey="name" tick={{ fontSize: 10 }} width={24} />
                  <Tooltip
                    formatter={(v) => [formatNumber(v as number), 'Catchments']}
                    contentStyle={{ fontSize: 11 }}
                  />
                  <Bar dataKey="value" radius={0}>
                    {regimeBarData.map((d, i) => (
                      <Cell key={i} fill={d.fill} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>

          {/* Top 10 table */}
          <div className="kpi-card flex-1 overflow-hidden">
            <div className="text-xs font-semibold text-gray-700 mb-2">Top 10 Catchments</div>
            {fLoading ? <Skeleton rows={10} /> : (
              <div className="overflow-y-auto" style={{ maxHeight: 180 }}>
                <table className="w-full text-xs">
                  <thead>
                    <tr className="border-b border-gray-100">
                      <th className="text-left pb-1 text-gray-500 font-medium">ID</th>
                      <th className="text-left pb-1 text-gray-500 font-medium">Priority</th>
                      <th className="text-right pb-1 text-gray-500 font-medium">Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {top10.map(c => (
                      <tr
                        key={c.catchment_id}
                        className={`border-b border-gray-50 cursor-pointer hover:bg-gray-50 transition-colors duration-150 ${selectedId === c.catchment_id ? 'bg-blue-50' : ''}`}
                        onClick={() => {
                          setSelectedId(c.catchment_id)
                          setFlyTo({ lng: c.lon, lat: c.lat, zoom: 11 })
                        }}
                        tabIndex={0}
                        onKeyDown={e => e.key === 'Enter' && setFlyTo({ lng: c.lon, lat: c.lat, zoom: 11 })}
                        aria-label={`Fly to catchment ${c.catchment_id}`}
                      >
                        <td className="py-1 text-accent font-medium">{c.catchment_id}</td>
                        <td className="py-1"><PriorityPill priority={c.priority} /></td>
                        <td className="py-1 text-right text-gray-700">{c.priority_score.toFixed(3)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Bottom row */}
      <div className="grid grid-cols-2 gap-4">
        {/* Events per year */}
        <div className="kpi-card">
          <div className="text-xs font-semibold text-gray-700 mb-2">Recorded Events per Year</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={eventsByYear} margin={{ left: -15 }}>
              <XAxis dataKey="year" tick={{ fontSize: 9 }} interval={4} />
              <YAxis tick={{ fontSize: 10 }} allowDecimals={false} />
              <Tooltip formatter={(v) => [v, 'Events']} contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="count" fill="#2563EB" radius={0} />
            </BarChart>
          </ResponsiveContainer>
          <div className="text-xs text-gray-400 mt-1">Event records: 122 points, Uttarakhand, 1970–2025</div>
        </div>

        {/* Regime summary cards */}
        <div className="kpi-card">
          <div className="text-xs font-semibold text-gray-700 mb-2">Regime Summary</div>
          {fLoading ? <Skeleton rows={5} /> : (
            <div className="space-y-1">
              {frontendData?.regimes.map(r => (
                <div key={r.regime} className="flex items-center gap-2 text-xs py-1 border-b border-gray-50 last:border-0">
                  <span
                    className="w-2 h-8 rounded-sm flex-shrink-0"
                    style={{ backgroundColor: regimeColor(r.regime) }}
                  />
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-gray-800 truncate">{r.regime}</div>
                    <div className="text-gray-500">
                      {formatNumber(r.n)} catchments · {formatNumber(r.elev_mean, 0)} m · {formatPop(r.pop_total)} pop avg
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
