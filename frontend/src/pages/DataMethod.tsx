import { useQuery } from '@tanstack/react-query'
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer,
} from 'recharts'
import { api } from '../api/client'
import { Skeleton } from '../components/Skeleton'
import { ErrorState } from '../components/EmptyState'

export default function DataMethod() {
  const { data, isLoading, error } = useQuery({
    queryKey: ['method'],
    queryFn: api.method,
  })

  if (error) return <ErrorState message="Failed to load method data." />

  const modelData = data?.model_selection ?? []
  const kmeansData = modelData.filter(r => r.model === 'kmeans')
  const gmmData = modelData.filter(r => r.model === 'gmm')

  const silData = [...kmeansData.map(r => ({ k: r.k, kmeans: r.sil }))].map(d => {
    const gmm = gmmData.find(r => r.k === d.k)
    return { ...d, gmm: gmm?.sil }
  })

  return (
    <div className="p-4 space-y-5">
      <div>
        <h1 className="text-xl font-semibold text-gray-900">Data &amp; Method</h1>
        <p className="text-sm text-gray-500">
          Analysis pipeline, data sources, feature definitions and model comparison
        </p>
      </div>

      {/* Pipeline */}
      <div className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="text-sm font-semibold text-gray-900 mb-4">Analysis Pipeline</div>
        <PipelineDiagram />
      </div>

      {/* Scope facts */}
      {isLoading ? <Skeleton rows={4} /> : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Coverage &amp; Scope</div>
          <div className="grid grid-cols-2 gap-x-6 gap-y-1">
            {data!.scope_facts.map((fact, i) => (
              <div key={i} className="text-xs text-gray-700 py-1 border-b border-gray-50 last:border-0">
                {fact}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Data sources */}
      {isLoading ? <Skeleton rows={4} /> : (
        <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
            <div className="text-sm font-semibold text-gray-900">Data Sources &amp; Grounding</div>
            <span className="text-xs text-gray-500">100% grounded in supplied project datasets</span>
          </div>
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Dataset</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Provider &amp; Resolution</th>
                <th className="px-4 py-2 text-left text-gray-500 font-medium">Coverage &amp; Temporal Extent</th>
              </tr>
            </thead>
            <tbody>
              {data!.data_sources.map((s, i) => (
                <tr key={i} className="border-b border-gray-50 hover:bg-gray-50">
                  <td className="px-4 py-2 font-medium text-gray-800">{s.name}</td>
                  <td className="px-4 py-2 text-gray-700">{s.source}</td>
                  <td className="px-4 py-2 text-gray-600">{s.coverage}</td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Grounding & Limitations Notice */}
          <div className="p-3 bg-amber-50/60 border-t border-amber-100 text-xs text-amber-900 flex flex-col gap-1">
            <div className="font-semibold text-amber-950 flex items-center gap-1.5">
              <span>Scientific Grounding &amp; Data Limitations Notice</span>
            </div>
            <p className="text-amber-800 leading-relaxed">
              <strong>Geographical Scope:</strong> The unsupervised physical model delineates and prioritises all 3,067 micro-catchments across both Uttarakhand and Himachal Pradesh. However, historical flood validation data consists of 122 recorded flash-flood events strictly within Uttarakhand (lat 29.2–31.1°N, lon 77.9–80.7°E). Himachal Pradesh catchments are classified according to identical physical criteria, but are <em>empirically unverified against historical events</em> due to the lack of supplied event records in that state.
            </p>
            <p className="text-amber-800 leading-relaxed">
              <strong>Event Precision:</strong> Out of 122 records, 40 are town-level precision matches (mapped to the exact containing catchment), and 82 are approximate locations mapped to catchment centroids within a 5 km radius.
            </p>
          </div>
        </div>
      )}

      {/* Feature definitions */}
      {isLoading ? <Skeleton rows={12} /> : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Feature Definitions</div>
          <div className="space-y-1">
            {data!.features.map((f, i) => {
              const [name, ...rest] = f.split(' – ')
              return (
                <div key={i} className="flex gap-3 text-xs py-1.5 border-b border-gray-50 last:border-0">
                  <code className="font-mono text-accent w-32 flex-shrink-0">{name}</code>
                  <span className="text-gray-700">{rest.join(' – ')}</span>
                </div>
              )
            })}
          </div>
        </div>
      )}

      {/* Pipeline steps */}
      {isLoading ? <Skeleton rows={8} /> : (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-3">Pipeline Steps</div>
          <ol className="space-y-2">
            {data!.pipeline_steps.map((step, i) => (
              <li key={i} className="flex gap-3 text-xs text-gray-700">
                <span className="w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center flex-shrink-0 font-medium text-xs">
                  {i + 1}
                </span>
                <span className="pt-0.5">{step}</span>
              </li>
            ))}
          </ol>
        </div>
      )}

      {/* Model comparison */}
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Model Comparison</div>
          <div className="text-xs text-gray-500 mb-3">K-Means vs GMM across K=4–8</div>
          {isLoading ? <Skeleton rows={10} /> : (
            <table className="w-full text-xs">
              <thead>
                <tr className="border-b border-gray-100">
                  <th className="pb-1 text-left text-gray-500 font-medium">Model</th>
                  <th className="pb-1 text-center text-gray-500 font-medium">K</th>
                  <th className="pb-1 text-right text-gray-500 font-medium">Silhouette</th>
                  <th className="pb-1 text-right text-gray-500 font-medium">DB</th>
                  <th className="pb-1 text-right text-gray-500 font-medium">Stability</th>
                  <th className="pb-1 text-right text-gray-500 font-medium">ARI</th>
                </tr>
              </thead>
              <tbody>
                {data!.model_selection.map((r, i) => {
                  const isSelected = r.model === 'gmm' && r.k === 5
                  return (
                    <tr
                      key={i}
                      className={`border-b border-gray-50 ${isSelected ? 'bg-blue-50 font-semibold' : ''}`}
                    >
                      <td className="py-1 uppercase text-gray-700">{r.model}</td>
                      <td className="py-1 text-center">{r.k}</td>
                      <td className="py-1 text-right tabular-nums">{r.sil.toFixed(4)}</td>
                      <td className="py-1 text-right tabular-nums">{r.db.toFixed(4)}</td>
                      <td className="py-1 text-right tabular-nums">{r.stability.toFixed(4)}</td>
                      <td className="py-1 text-right tabular-nums">{r.ARI_vs_ward.toFixed(4)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          <div className="mt-2 text-xs text-gray-400">Highlighted: selected model (GMM K=5)</div>
        </div>

        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="text-sm font-semibold text-gray-900 mb-1">Silhouette Score by K</div>
          <div className="text-xs text-gray-500 mb-3">Higher is better; K=5 GMM selected</div>
          {isLoading ? <Skeleton rows={5} /> : (
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={silData} margin={{ left: -15 }}>
                <XAxis dataKey="k" tick={{ fontSize: 11 }} label={{ value: 'K', position: 'insideBottom', offset: -2, fontSize: 11 }} />
                <YAxis tick={{ fontSize: 10 }} domain={[0, 0.25]} />
                <Tooltip
                  formatter={(v, name) => [(v as number).toFixed(4), name as string]}
                  contentStyle={{ fontSize: 11 }}
                />
                <Bar dataKey="kmeans" name="K-Means" fill="#64748B" radius={0} />
                <Bar dataKey="gmm" name="GMM" fill="#2563EB" radius={0} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>
      </div>
    </div>
  )
}

function PipelineDiagram() {
  const steps = [
    { label: 'DEM', sub: 'SRTM 90 m', color: '#94A3B8' },
    { label: 'Catchments', sub: 'D8 routing', color: '#78716C' },
    { label: 'Features', sub: '12 terrain+rain', color: '#059669' },
    { label: 'GMM Clustering', sub: 'K=5', color: '#D97706' },
    { label: 'Regimes R1–R5', sub: 'By hazard order', color: '#B91C1C' },
    { label: 'Priority Score', sub: 'Hazard × Exposure', color: '#EA580C' },
    { label: 'Validation', sub: 'AUC 122 events', color: '#2563EB' },
  ]

  return (
    <div className="flex items-center gap-1 overflow-x-auto pb-2" role="img" aria-label="Analysis pipeline diagram">
      {steps.map((s, i) => (
        <div key={s.label} className="flex items-center flex-shrink-0">
          <div className="text-center">
            <div
              className="w-24 py-2 px-1 rounded-md text-white text-center"
              style={{ backgroundColor: s.color }}
            >
              <div className="text-xs font-semibold leading-tight">{s.label}</div>
              <div className="text-xs opacity-80 leading-tight mt-0.5">{s.sub}</div>
            </div>
          </div>
          {i < steps.length - 1 && (
            <svg width="24" height="16" className="flex-shrink-0 mx-0.5" aria-hidden="true">
              <path d="M2 8 L18 8 M14 4 L18 8 L14 12" stroke="#94A3B8" strokeWidth="1.5" fill="none" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          )}
        </div>
      ))}
    </div>
  )
}
