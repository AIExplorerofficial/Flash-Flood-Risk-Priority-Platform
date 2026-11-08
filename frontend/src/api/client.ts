// Single typed API client - all fetch logic lives here
import type {
  AlertResponse,
  AlertTiersResponse,
  ArchetypeProfile,
  CatchmentDetail,
  CatchmentListResponse,
  EventsResponse,
  FrontendData,
  MethodResponse,
  PlanRequest,
  PlanResponse,
  RankRequest,
  RankResponse,
  SummaryResponse,
  ValidateRequest,
  ValidateResponse,
} from './types'

const BASE = '/api'

async function req<T>(path: string, options?: RequestInit): Promise<T> {
  const res = await fetch(BASE + path, {
    headers: { 'Content-Type': 'application/json', ...options?.headers },
    ...options,
  })
  if (!res.ok) {
    const text = await res.text().catch(() => res.statusText)
    throw new Error(`API ${res.status}: ${text}`)
  }
  return res.json() as Promise<T>
}

export const api = {
  summary: (): Promise<SummaryResponse> =>
    req('/summary'),

  catchments: (params: Record<string, string | number | boolean | undefined>): Promise<CatchmentListResponse> => {
    const q = new URLSearchParams()
    for (const [k, v] of Object.entries(params)) {
      if (v !== undefined && v !== null && v !== '') q.set(k, String(v))
    }
    return req(`/catchments?${q}`)
  },

  catchment: (id: number): Promise<CatchmentDetail> =>
    req(`/catchments/${id}`),

  rank: (body: RankRequest): Promise<RankResponse> =>
    req('/rank', { method: 'POST', body: JSON.stringify(body) }),

  validate: (body: ValidateRequest): Promise<ValidateResponse> =>
    req('/validate', { method: 'POST', body: JSON.stringify(body) }),

  plan: (body: PlanRequest): Promise<PlanResponse> =>
    req('/plan', { method: 'POST', body: JSON.stringify(body) }),

  planExportCsvUrl: (body: PlanRequest): string => {
    void body
    return BASE + '/plan/export/csv'
  },

  planExportCsv: async (body: PlanRequest): Promise<Blob> => {
    const res = await fetch(BASE + '/plan/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.blob()
  },

  planExportGeoJSON: async (body: PlanRequest): Promise<Blob> => {
    const res = await fetch(BASE + '/plan/export/geojson', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    })
    return res.blob()
  },

  alerts: (id: number): Promise<AlertResponse> =>
    req(`/alerts/${id}`),

  alertTiers: (): Promise<AlertTiersResponse> =>
    req('/alerts/tiers'),

  events: (): Promise<EventsResponse> =>
    req('/events'),

  method: (): Promise<MethodResponse> =>
    req('/method'),

  geojsonUrl: (): string => BASE + '/geojson',

  archetypeProfiles: (): Promise<ArchetypeProfile[]> =>
    req('/archetype-profiles'),

  frontendData: (): Promise<FrontendData> =>
    req('/frontend-data'),
}

export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}
