export interface GeoJsonFeature {
  type: string
  id?: number | string
  geometry: {
    type: string
    coordinates: unknown
  }
  properties: Record<string, unknown>
}

export interface GeoJsonFeatureCollection {
  type: string
  features: GeoJsonFeature[]
}

let globalGeoJsonCache: GeoJsonFeatureCollection | null = null
let globalGeoJsonPromise: Promise<GeoJsonFeatureCollection> | null = null

export function hasCachedGeoJson(): boolean {
  return globalGeoJsonCache !== null
}

export function preloadGeoJson(): Promise<GeoJsonFeatureCollection> {
  if (globalGeoJsonCache) return Promise.resolve(globalGeoJsonCache)
  if (!globalGeoJsonPromise) {
    globalGeoJsonPromise = fetch('/api/geojson')
      .then(res => {
        if (!res.ok) throw new Error(`Failed to load GeoJSON (status ${res.status})`)
        return res.json() as Promise<GeoJsonFeatureCollection>
      })
      .then(data => {
        globalGeoJsonCache = data
        return data
      })
      .catch(err => {
        globalGeoJsonPromise = null
        throw err
      })
  }
  return globalGeoJsonPromise
}

// Automatically eager prefetch when file is imported in the browser
if (typeof window !== 'undefined') {
  preloadGeoJson().catch(() => {})
}
