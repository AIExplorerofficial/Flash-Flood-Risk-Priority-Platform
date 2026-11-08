import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
} from 'recharts'
import { api } from '../api/client'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'
import { formatNumber, formatPop, regimeColor } from '../utils/format'

export default function Regimes() {
  const { data: frontendData, isLoading, error } = useQuery({
    queryKey: ['frontend-data'],
    queryFn: api.frontendData,
  })

  const { data: profiles, isLoading: pLoading } = useQuery({
    queryKey: ['archetype-profiles'],
    queryFn: api.archetypeProfiles,
  })

  if (error) return <ErrorState message="Failed to load regime data." />

  const totalCatchments = frontendData?.regimes.reduce((s, r) => s + r.n, 0) ?? 0

  const eventRates = frontendData?.validation?.event_rate_by_regime ?? []

  return (
    <div className="p-4 space-y-4">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Terrain–Rainfall Regimes</h1>
        <p className="text-sm text-gray-500">
          Five Gaussian-mixture clusters ordered by mean hazard index · IMD 0.25° daily 2015–2025 · SRTM 90 m
        </p>
      </div>

      {/* Regime cards */}
      {isLoading
        ? <div className="grid grid-cols-5 gap-3">{Array.from({ length: 5 }).map((_, i) => <Skeleton key={i} rows={5} className="bg-white border border-gray-200 rounded-lg p-3" />)}</div>
        : (
          <div className="grid grid-cols-5 gap-3">
            {frontendData!.regimes.map(r => {
              const rk = r.regime.split(' ')[0]
              const color = regimeColor(r.regime)
              const share = totalCatchments > 0 ? r.n / totalCatchments : 0
              const evRate = eventRates.find(e => e.regime === r.regime)
              return (
                <div key={r.regime} className="bg-white rounded-lg border border-gray-200 p-3" style={{ borderTop: `3px solid ${color}` }}>
                  <div className="text-sm font-semibold text-gray-900 mb-1">{rk}</div>
                  <div className="text-xs text-gray-500 mb-2 leading-tight">{r.regime.split(', ').slice(1).join(', ')}</div>
                  <div className="space-y-1 text-xs text-gray-700">
                    <div className="flex justify-between">
                      <span className="text-gray-500">Count</span>
                      <span className="font-medium">{formatNumber(r.n)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Share</span>
                      <span className="font-medium">{(share * 100).toFixed(1)}%</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Elev</span>
                      <span className="font-medium">{formatNumber(r.elev_mean, 0)} m</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Slope</span>
                      <span className="font-medium">{r.slope_p90.toFixed(1)}°</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">p99 rain</span>
                      <span className="font-medium">{r.p99_wetday.toFixed(1)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Max 3-day</span>
                      <span className="font-medium">{r.max3d.toFixed(0)} mm</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-gray-500">Pop (mean)</span>
                      <span className="font-medium">{formatPop(r.pop_total)}</span>
                    </div>
                    {evRate && (
                      <div className="flex justify-between">
                        <span className="text-gray-500">Event rate</span>
                        <span className="font-medium">{(evRate.rate * 100).toFixed(1)}%</span>
                      </div>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
        )}

      {/* Feature heatmap + PCA scatter */}
      <div className="grid grid-cols-2 gap-4">
        {/* Archetype profile heatmap */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Feature Profile by Regime (z-scored means)</div>
          {pLoading ? <Skeleton rows={10} /> : (
            profiles && (
              <ArchetypeHeatmap profiles={profiles} />
            )
          )}
        </div>

        {/* PCA scatter image */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">PCA Space</div>
          <div className="text-xs text-gray-500 mb-2">PC1 28.2% · PC2 27.5% · PC3 12.7%</div>
          <img
            src="/static/pca_regimes.png"
            alt="Regimes in PCA space"
            className="w-full rounded"
          />
        </div>
      </div>

      {/* Event rate by regime bar */}
      {eventRates.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Event Rate by Regime</div>
          <div className="text-xs text-gray-500 mb-3">Share of catchments in event footprint with ≥1 recorded event</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={eventRates.map(e => ({ ...e, name: e.regime.split(' ')[0] }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                formatter={(v) => [`${((v as number) * 100).toFixed(1)}%`, 'Event rate']}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="rate" radius={0}>
                {eventRates.map(e => (
                  <Cell key={e.regime} fill={regimeColor(e.regime)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Maps image */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <div className="text-sm font-semibold text-gray-900 mb-1">Analysis Maps</div>
        <div className="text-xs text-gray-500 mb-2">Regime · Priority · Regime shift (2015–19 vs 2021–25)</div>
        <img
          src="/static/maps.png"
          alt="Regime, priority and shift maps"
          className="w-full rounded"
        />
      </div>
    </div>
  )
}

interface HeatmapProps {
  profiles: Array<{
    h_rank: number
    n: number
    hazard_index: number
    area_km2: number
    elev_mean: number
    slope_p90: number
    melton: number
    drainage_density: number
    tc_min: number
    p99_wetday: number
    max3d: number
    heavy_days: number
    jjas_share: number
    frac_above_4500: number
    pop_total: number
    pop_near_channel: number
  }>
}

const HEATMAP_FEATURES = [
  { key: 'elev_mean', label: 'Elevation' },
  { key: 'slope_p90', label: 'Slope p90' },
  { key: 'melton', label: 'Melton' },
  { key: 'drainage_density', label: 'Drainage density' },
  { key: 'tc_min', label: 'Time of conc.' },
  { key: 'p99_wetday', label: 'p99 wet-day' },
  { key: 'max3d', label: 'Max 3-day' },
  { key: 'heavy_days', label: 'Heavy days' },
  { key: 'jjas_share', label: 'JJAS share' },
  { key: 'frac_above_4500', label: 'Frac >4500 m' },
  { key: 'hazard_index', label: 'Hazard index' },
]

function zScore(values: number[]): number[] {
  const mean = values.reduce((a, b) => a + b, 0) / values.length
  const std = Math.sqrt(values.reduce((s, v) => s + (v - mean) ** 2, 0) / values.length) || 1
  return values.map(v => (v - mean) / std)
}

function heatColor(z: number): string {
  const t = Math.max(-2.5, Math.min(2.5, z))
  const norm = (t + 2.5) / 5
  if (norm < 0.5) {
    const f = norm / 0.5
    return `rgb(${Math.round(214 + f * (255 - 214))},${Math.round(234 + f * (237 - 234))},${Math.round(248 + f * (234 - 248))})`
  }
  const f = (norm - 0.5) / 0.5
  return `rgb(${Math.round(255 - f * (255 - 180))},${Math.round(237 - f * (237 - 60))},${Math.round(234 - f * (234 - 50))})`
}

function ArchetypeHeatmap({ profiles }: HeatmapProps) {
  const regimes = profiles.map(p => `R${p.h_rank + 1}`)

  return (
    <div className="overflow-x-auto">
      <table className="text-xs w-full">
        <thead>
          <tr>
            <th className="text-left pb-1 text-gray-500 font-medium pr-3 w-28">Feature</th>
            {regimes.map(r => (
              <th key={r} className="text-center pb-1 text-gray-500 font-medium px-2">{r}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {HEATMAP_FEATURES.map(({ key, label }) => {
            const vals = profiles.map(p => (p as Record<string, number>)[key] ?? 0)
            const zs = zScore(vals)
            return (
              <tr key={key} className="border-b border-gray-50">
                <td className="py-1 pr-3 text-gray-600 whitespace-nowrap">{label}</td>
                {zs.map((z, i) => (
                  <td
                    key={i}
                    className="py-1 px-2 text-center font-medium"
                    style={{ backgroundColor: heatColor(z) }}
                    title={`${label} R${i + 1}: ${profiles[i] ? (profiles[i] as Record<string, number>)[key]?.toFixed(2) : ''} (z=${z.toFixed(2)})`}
                  >
                    {z.toFixed(1)}
                  </td>
                ))}
              </tr>
            )
          })}
        </tbody>
      </table>
      <div className="flex items-center gap-2 mt-2 text-xs text-gray-400">
        <div className="w-16 h-2 rounded" style={{ background: 'linear-gradient(to right, #D6EAF8, #FFEDA2, #B43C32)' }} />
        <span>Low → High</span>
      </div>
    </div>
  )
}
