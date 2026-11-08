import { useState, useEffect } from 'react'
import { useMutation } from '@tanstack/react-query'
import { Download, Loader2, Printer } from 'lucide-react'
import { api, downloadBlob } from '../api/client'
import { PriorityPill } from '../components/PriorityPill'
import { EmptyState } from '../components/EmptyState'
import { formatNumber, formatPop, formatArea, PRIORITY_ORDER } from '../utils/format'
import type { PlanRequest, PlanCatchment } from '../api/types'

export default function ActionPlanner() {
  const [classes, setClasses] = useState<string[]>(['P1 Critical', 'P2 High'])
  const [selectedRegimes, setSelectedRegimes] = useState<string[]>([])
  const [minPop, setMinPop] = useState(0)
  const [maxCatchments, setMaxCatchments] = useState(200)
  const [result, setResult] = useState<{ catchments: PlanCatchment[]; total_catchments: number; total_population: number; total_area: number; by_action: Record<string, number>; by_priority: Record<string, number> } | null>(null)

  const mutation = useMutation({
    mutationFn: (req: PlanRequest) => api.plan(req),
    onSuccess: (data) => setResult(data),
  })

  // Load default plan on mount
  useEffect(() => {
    mutation.mutate({
      classes: ['P1 Critical', 'P2 High'],
      min_population: 0,
      max_catchments: 200,
    })
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function buildRequest(): PlanRequest {
    return {
      classes,
      regimes: selectedRegimes.length > 0 ? selectedRegimes : undefined,
      min_population: minPop,
      max_catchments: maxCatchments,
    }
  }

  function handleGenerate() {
    mutation.mutate(buildRequest())
  }

  async function handleExportCsv() {
    const blob = await api.planExportCsv(buildRequest())
    downloadBlob(blob, 'action_plan.csv')
  }

  async function handleExportGeoJSON() {
    const blob = await api.planExportGeoJSON(buildRequest())
    downloadBlob(blob, 'action_plan.geojson')
  }

  function handlePrint() {
    window.print()
  }

  function toggleClass(c: string) {
    setClasses(prev => prev.includes(c) ? prev.filter(x => x !== c) : [...prev, c])
  }

  function toggleRegime(r: string) {
    setSelectedRegimes(prev => prev.includes(r) ? prev.filter(x => x !== r) : [...prev, r])
  }

  // Group by action
  const byAction: Record<string, PlanCatchment[]> = {}
  if (result) {
    for (const c of result.catchments) {
      if (!byAction[c.action]) byAction[c.action] = []
      byAction[c.action].push(c)
    }
  }

  return (
    <div className="p-4 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-xl font-semibold text-gray-900">Action Planner</h1>
          <p className="text-sm text-gray-500">Build a prioritised field-team action list from selected catchments</p>
        </div>
        {result && (
          <div className="flex gap-2">
            <button onClick={handleExportCsv} className="btn-secondary text-xs flex items-center gap-1">
              <Download size={12} /> CSV
            </button>
            <button onClick={handleExportGeoJSON} className="btn-secondary text-xs flex items-center gap-1">
              <Download size={12} /> GeoJSON
            </button>
            <button onClick={handlePrint} className="btn-secondary text-xs flex items-center gap-1">
              <Printer size={12} /> Print brief
            </button>
          </div>
        )}
      </div>

      {/* Filters */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-4 gap-4">
        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Priority classes</div>
          {PRIORITY_ORDER.map(p => (
            <label key={p} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
              <input
                type="checkbox"
                checked={classes.includes(p)}
                onChange={() => toggleClass(p)}
                className="text-accent"
              />
              {p}
            </label>
          ))}
        </div>

        <div>
          <div className="text-xs font-semibold text-gray-700 mb-2">Regimes (all if none)</div>
          {['R1', 'R2', 'R3', 'R4', 'R5'].map(r => (
            <label key={r} className="flex items-center gap-2 text-xs py-0.5 cursor-pointer">
              <input
                type="checkbox"
                checked={selectedRegimes.includes(r)}
                onChange={() => toggleRegime(r)}
                className="text-accent"
              />
              {r}
            </label>
          ))}
        </div>

        <div className="space-y-3">
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Min population</div>
            <input
              type="number"
              value={minPop}
              min={0}
              onChange={e => setMinPop(Number(e.target.value))}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
              aria-label="Minimum population"
            />
          </div>
          <div>
            <div className="text-xs font-semibold text-gray-700 mb-1">Max catchments</div>
            <input
              type="number"
              value={maxCatchments}
              min={1}
              max={3067}
              onChange={e => setMaxCatchments(Number(e.target.value))}
              className="w-full text-xs border border-gray-300 rounded px-2 py-1.5"
              aria-label="Max catchments"
            />
          </div>
        </div>

        <div className="flex flex-col justify-end">
          <button
            onClick={handleGenerate}
            disabled={mutation.isPending || classes.length === 0}
            className="btn-primary flex items-center gap-1.5 justify-center"
          >
            {mutation.isPending && <Loader2 size={14} className="animate-spin" />}
            Generate plan
          </button>
        </div>
      </div>

      {/* Summary */}
      {result && (
        <div className="grid grid-cols-4 gap-3">
          <div className="kpi-card">
            <div className="text-xs text-gray-500">Catchments</div>
            <div className="text-xl font-semibold text-gray-900">{formatNumber(result.total_catchments)}</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-500">Total population</div>
            <div className="text-xl font-semibold text-gray-900">{formatPop(result.total_population)}</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-500">Total area</div>
            <div className="text-xl font-semibold text-gray-900">{formatArea(result.total_area)}</div>
          </div>
          <div className="kpi-card">
            <div className="text-xs text-gray-500">Action types</div>
            <div className="text-xl font-semibold text-gray-900">{Object.keys(result.by_action).length}</div>
          </div>
        </div>
      )}

      {/* Results grouped by action */}
      {!result && !mutation.isPending && (
        <EmptyState
          message="Configure the filters above and click Generate plan."
          filters={classes.length === 0 ? 'No priority classes selected' : undefined}
          onClear={classes.length === 0 ? () => setClasses(['P1 Critical', 'P2 High']) : undefined}
        />
      )}

      {Object.entries(byAction).map(([action, catchments]) => (
        <div key={action} className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 bg-gray-50">
            <div className="text-sm font-semibold text-gray-900">{action}</div>
            <div className="text-xs text-gray-500 mt-0.5">
              {formatNumber(catchments.length)} catchments · {formatPop(catchments.reduce((s, c) => s + c.pop_total, 0))} population
            </div>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">ID</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Priority</th>
                  <th className="px-3 py-2 text-left text-gray-500 font-medium">Regime</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Score</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Population</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Elevation</th>
                  <th className="px-3 py-2 text-right text-gray-500 font-medium">Watch</th>
                </tr>
              </thead>
              <tbody>
                {catchments.map(c => (
                  <tr key={c.catchment_id} className="border-b border-gray-50 hover:bg-gray-50">
                    <td className="px-3 py-1.5 text-accent font-medium">#{c.catchment_id}</td>
                    <td className="px-3 py-1.5"><PriorityPill priority={c.priority} /></td>
                    <td className="px-3 py-1.5 text-gray-700">{c.regime.split(' ')[0]}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.priority_score.toFixed(4)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatPop(c.pop_total)}</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{formatNumber(c.elev_mean, 0)} m</td>
                    <td className="px-3 py-1.5 text-right tabular-nums">{c.watch_mm.toFixed(1)} mm</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </div>
  )
}
