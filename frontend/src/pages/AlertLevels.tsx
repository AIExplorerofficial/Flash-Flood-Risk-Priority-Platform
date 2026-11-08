import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts'
import { Search } from 'lucide-react'
import { api } from '../api/client'
import FloodMap from '../components/FloodMap'
import MapLegend from '../components/MapLegend'
import { PriorityPill } from '../components/PriorityPill'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'

const IMD_ORANGE = 115.6

export default function AlertLevels() {
  const [searchId, setSearchId] = useState('')
  const [lookupId, setLookupId] = useState<number | null>(null)

  const { data: tiers, isLoading: tLoading, error: tError } = useQuery({
    queryKey: ['alert-tiers'],
    queryFn: api.alertTiers,
  })

  const { data: alertDetail, isLoading: aLoading, error: aError } = useQuery({
    queryKey: ['alert', lookupId],
    queryFn: () => api.alerts(lookupId!),
    enabled: lookupId !== null,
  })

  function handleSearch() {
    const id = parseInt(searchId, 10)
    if (!isNaN(id)) setLookupId(id)
  }

  if (tError) return <ErrorState message="Failed to load alert tier data." />

  const tierData = tiers?.tiers.map(t => ({
    name: t.haz_tier,
    watch: t.watch_mm,
    warn: t.warn_mm,
    watch_days: t.watch_days_yr,
    warn_days: t.warn_days_yr,
    imd_days: t.imd_orange_days_yr,
  })) ?? []

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Alert Levels</h1>
        <p className="text-sm text-gray-500">
          Watch and warning rainfall thresholds by tier · IMD orange level: {IMD_ORANGE} mm/d
        </p>
      </div>

      {/* Catchment lookup */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-900 mb-3">Catchment Alert Lookup</div>
        <div className="flex gap-2 max-w-xs">
          <input
            type="text"
            placeholder="Enter catchment ID"
            value={searchId}
            onChange={e => setSearchId(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && handleSearch()}
            className="flex-1 text-sm border border-gray-300 rounded px-3 py-1.5"
            aria-label="Catchment ID for alert lookup"
          />
          <button onClick={handleSearch} className="btn-primary flex items-center gap-1 py-1.5">
            <Search size={14} /> Look up
          </button>
        </div>

        {aLoading && <Skeleton rows={4} className="mt-3" />}
        {aError && <div className="mt-2 text-xs text-red-600">Catchment not found.</div>}
        {alertDetail && (
          <div className="mt-4 grid grid-cols-5 gap-3">
            <div className="kpi-card">
              <div className="text-xs text-gray-500">Catchment</div>
              <div className="text-lg font-semibold">#{alertDetail.catchment_id}</div>
              <div className="text-xs mt-1"><PriorityPill priority={alertDetail.priority} /></div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-gray-500">Watch level</div>
              <div className="text-lg font-semibold">{alertDetail.watch_mm.toFixed(1)} <span className="text-sm font-normal text-gray-500">mm/d</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{alertDetail.watch_days_yr.toFixed(1)} d/yr</div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-gray-500">Warning level</div>
              <div className="text-lg font-semibold">{alertDetail.warn_mm.toFixed(1)} <span className="text-sm font-normal text-gray-500">mm/d</span></div>
              <div className="text-xs text-gray-400 mt-0.5">{alertDetail.warn_days_yr.toFixed(1)} d/yr</div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-gray-500">IMD orange days</div>
              <div className="text-lg font-semibold">{alertDetail.imd_orange_days_yr.toFixed(2)}</div>
              <div className="text-xs text-gray-400 mt-0.5">d/yr at {IMD_ORANGE} mm</div>
            </div>
            <div className="kpi-card">
              <div className="text-xs text-gray-500">Regime</div>
              <div className="text-sm font-medium text-gray-800 leading-tight mt-1">{alertDetail.regime}</div>
            </div>
          </div>
        )}
      </div>

      {/* Tier table */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100">
          <div className="text-sm font-semibold text-gray-900">Alert Thresholds by Tier</div>
        </div>
        {tLoading ? (
          <div className="p-4"><Skeleton rows={4} cols={5} /></div>
        ) : (
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Tier</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Watch (mm/d)</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Warning (mm/d)</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Watch days/yr</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">Warn days/yr</th>
                <th className="px-4 py-2 text-right text-gray-500 font-medium">IMD orange d/yr</th>
              </tr>
            </thead>
            <tbody>
              {tiers?.tiers.map(t => (
                <tr key={t.haz_tier} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{t.haz_tier}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.watch_mm.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.warn_mm.toFixed(2)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.watch_days_yr.toFixed(3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.warn_days_yr.toFixed(3)}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{t.imd_orange_days_yr.toFixed(4)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Chart */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Rainfall Thresholds by Tier</div>
          <div className="text-xs text-gray-500 mb-3">Watch and warning levels (mm/d)</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tierData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="watch" name="Watch" fill="#D97706" radius={0} />
              <Bar dataKey="warn" name="Warning" fill="#DC2626" radius={0} />
              <ReferenceLine y={IMD_ORANGE} stroke="#64748B" strokeDasharray="4 2" label={{ value: 'IMD orange', fontSize: 10, fill: '#64748B' }} />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Days per Year by Tier</div>
          <div className="text-xs text-gray-500 mb-3">Mean days reaching each threshold</div>
          <ResponsiveContainer width="100%" height={180}>
            <BarChart data={tierData}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} />
              <Tooltip contentStyle={{ fontSize: 11 }} />
              <Bar dataKey="watch_days" name="Watch d/yr" fill="#D97706" radius={0} />
              <Bar dataKey="warn_days" name="Warning d/yr" fill="#DC2626" radius={0} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Map with watch level */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden" style={{ height: 320 }}>
        <div className="px-4 py-3 border-b border-gray-100 text-sm font-semibold text-gray-900">
          Watch Rainfall Level Map
        </div>
        <div style={{ height: 272 }} className="relative">
          <FloodMap layer="watch_mm" selectedId={lookupId} className="absolute inset-0" />
          <div className="absolute bottom-3 left-3 z-10">
            <MapLegend layer="watch_mm" />
          </div>
        </div>
      </div>
    </div>
  )
}
