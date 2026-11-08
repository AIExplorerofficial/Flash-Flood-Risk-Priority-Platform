import { useState, useEffect } from 'react'
import { useMutation, useQuery } from '@tanstack/react-query'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts'
import { Loader2 } from 'lucide-react'
import { api } from '../api/client'
import FloodMap from '../components/FloodMap'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'
import { formatNumber, regimeColor, PRIORITY_COLORS } from '../utils/format'
import type { ValidateResponse } from '../api/types'

const AUC_LABELS: Record<string, string> = {
  hazard_index: 'Hazard index',
  slope_p90: 'Slope p90',
  p99_wetday: 'p99 wet-day',
  max3d: 'Max 3-day',
  exposure_index: 'Exposure index',
  priority_score: 'Priority score',
}

export default function Validation() {
  const [eventSet, setEventSet] = useState<'all' | 'town_only'>('all')
  const [scope, setScope] = useState<'footprint' | 'belt'>('belt')
  const [result, setResult] = useState<ValidateResponse | null>(null)

  const { data: eventsData } = useQuery({
    queryKey: ['events'],
    queryFn: api.events,
  })

  const mutation = useMutation({
    mutationFn: () => api.validate({ event_set: eventSet, scope }),
    onSuccess: (data) => setResult(data),
  })

  // Run on mount
  useEffect(() => {
    mutation.mutate()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleRun() {
    mutation.mutate()
  }

  const activeEvents = eventSet === 'town_only' ? eventsData?.events_town : eventsData?.events_all

  const aucEntries = result
    ? Object.entries(result.auc).map(([key, v]) => ({
        name: AUC_LABELS[key] ?? key,
        auc: v.auc,
        lo: v.lo,
        hi: v.hi,
        isScore: key === 'priority_score',
      }))
    : []

  const liftData = result
    ? [
        { name: 'P1+P2 area share', value: result.p12_share, color: PRIORITY_COLORS['P1 Critical'] },
        { name: 'Event capture', value: result.p12_event_capture, color: PRIORITY_COLORS['P2 High'] },
      ]
    : []

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Event Validation</h1>
          <p className="text-sm text-gray-500">
            AUC against recorded flash-flood events · 300-draw bootstrap 95% CI · seed 42
          </p>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-3">
          <div>
            <div className="text-xs text-gray-500 mb-1">Event set</div>
            <select
              value={eventSet}
              onChange={e => setEventSet(e.target.value as 'all' | 'town_only')}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
              aria-label="Event set"
            >
              <option value="all">All events (122)</option>
              <option value="town_only">Town-level only (40)</option>
            </select>
          </div>
          <div>
            <div className="text-xs text-gray-500 mb-1">Scope</div>
            <select
              value={scope}
              onChange={e => setScope(e.target.value as 'footprint' | 'belt')}
              className="text-xs border border-gray-300 rounded px-2 py-1.5 bg-white"
              aria-label="Validation scope"
            >
              <option value="belt">Belt catchments</option>
              <option value="footprint">Full footprint</option>
            </select>
          </div>
          <button
            onClick={handleRun}
            disabled={mutation.isPending}
            className="btn-primary flex items-center gap-1.5 self-end"
          >
            {mutation.isPending ? <Loader2 size={14} className="animate-spin" /> : null}
            {mutation.isPending ? 'Running…' : 'Validate'}
          </button>
        </div>
      </div>

      {mutation.isError && <ErrorState message="Validation failed. Check the backend connection." />}

      {/* Summary row */}
      {result && (
        <div className="grid grid-cols-5 gap-3">
          {[
            { label: 'Catchments in scope', value: formatNumber(result.n_catchments) },
            { label: 'Event catchments', value: formatNumber(result.n_event_catchments) },
            { label: 'P1+P2 area share', value: `${(result.p12_share * 100).toFixed(2)}%` },
            { label: 'Event capture', value: `${(result.p12_event_capture * 100).toFixed(2)}%` },
            { label: 'Lift', value: result.lift.toFixed(4) },
          ].map(stat => (
            <div key={stat.label} className="kpi-card">
              <div className="text-xs text-gray-500">{stat.label}</div>
              <div className="text-xl font-semibold text-gray-900 mt-1">{stat.value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        {/* AUC table */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">AUC with 95% Bootstrap CI</div>
          {mutation.isPending ? (
            <Skeleton rows={6} />
          ) : !result ? (
            <div className="text-xs text-gray-500">Select an event set and scope, then click Validate.</div>
          ) : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="text-left pb-2 text-gray-500 font-medium">Score</th>
                  <th className="text-right pb-2 text-gray-500 font-medium">AUC</th>
                  <th className="text-right pb-2 text-gray-500 font-medium">95% CI</th>
                </tr>
              </thead>
              <tbody>
                {aucEntries.map(row => (
                  <tr
                    key={row.name}
                    className={`border-b border-gray-50 ${row.isScore ? 'font-semibold bg-blue-50' : ''}`}
                  >
                    <td className="py-1.5 text-gray-800">{row.name}</td>
                    <td className="py-1.5 text-right tabular-nums">{row.auc.toFixed(4)}</td>
                    <td className="py-1.5 text-right text-gray-500 tabular-nums">
                      [{row.lo.toFixed(3)}, {row.hi.toFixed(3)}]
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
          <div className="mt-3 text-xs text-gray-400">
            Numbers as computed. Bootstrap 300 draws, seed 42.
          </div>
        </div>

        {/* Lift chart */}
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">P1+P2 Lift</div>
          <div className="text-xs text-gray-500 mb-3">Area share vs event capture</div>
          {!result ? (
            <div className="text-xs text-gray-500">Run validation to see lift.</div>
          ) : (
            <>
              <ResponsiveContainer width="100%" height={160}>
                <BarChart data={liftData} margin={{ left: -15 }}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} domain={[0, Math.max(result.p12_share, result.p12_event_capture) * 1.3]} />
                  <Tooltip formatter={(v) => [`${((v as number) * 100).toFixed(2)}%`]} contentStyle={{ fontSize: 11 }} />
                  <Bar dataKey="value" radius={0}>
                    {liftData.map((d, i) => <Cell key={i} fill={d.color} />)}
                  </Bar>
                  <ReferenceLine y={result.p12_share} stroke="#64748B" strokeDasharray="3 3" />
                </BarChart>
              </ResponsiveContainer>
              <div className="text-xs text-gray-600 mt-2">
                Lift = capture / area share = <span className="font-semibold">{result.lift.toFixed(4)}</span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Event rate by regime */}
      {result && result.event_rate_by_regime.length > 0 && (
        <div className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Event Rate by Regime</div>
          <div className="text-xs text-gray-500 mb-3">In-scope catchments with ≥1 event</div>
          <ResponsiveContainer width="100%" height={160}>
            <BarChart data={result.event_rate_by_regime.map(e => ({
              name: e.regime.split(' ')[0],
              rate: e.rate,
              fill: regimeColor(e.regime),
            }))}>
              <XAxis dataKey="name" tick={{ fontSize: 11 }} />
              <YAxis tick={{ fontSize: 10 }} tickFormatter={v => `${(v * 100).toFixed(0)}%`} />
              <Tooltip
                formatter={(v) => [`${((v as number) * 100).toFixed(1)}%`, 'Event rate']}
                contentStyle={{ fontSize: 11 }}
              />
              <Bar dataKey="rate" radius={0}>
                {result.event_rate_by_regime.map((e, i) => (
                  <Cell key={i} fill={regimeColor(e.regime)} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* Map with events */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden" style={{ height: 350 }}>
        <div className="text-xs font-semibold text-gray-700 p-3 border-b border-gray-100 flex items-center justify-between">
          <span>Priority layer with recorded flood events ({activeEvents?.length ?? 0} events)</span>
          <div className="flex items-center gap-3 text-[11px] text-gray-500 font-normal">
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#1D4ED8] inline-block border border-white" />
              Town-level
            </span>
            <span className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full bg-[#F59E0B] inline-block border border-white" />
              Catchment-level
            </span>
          </div>
        </div>
        <div style={{ height: 300 }} className="relative">
          <FloodMap
            layer="priority"
            events={activeEvents}
            showEvents={true}
            className="absolute inset-0"
          />
        </div>
      </div>
    </div>
  )
}
