import { useEffect, useRef, useState, useCallback } from 'react'
import * as maplibregl from 'maplibre-gl'
import 'maplibre-gl/dist/maplibre-gl.css'

// Ensure MapLibre Web Worker loads correctly from public directory in Vite
maplibregl.setWorkerUrl('/maplibre-gl-worker.mjs')
import { AlertCircle, RefreshCw } from 'lucide-react'
import { PRIORITY_COLORS, REGIME_COLORS } from '../utils/format'
import type { EventPoint } from '../api/types'
import {
  type GeoJsonFeature,
  type GeoJsonFeatureCollection,
  hasCachedGeoJson,
  preloadGeoJson,
} from '../api/geojson'

export type MapLayer =
  | 'priority'
  | 'regime'
  | 'priority_score'
  | 'exposure_index'
  | 'hazard_index'
  | 'elev_mean'
  | 'slope_p90'
  | 'pop_total'
  | 'watch_mm'

interface Props {
  layer: MapLayer
  onCatchmentClick?: (id: number, lngLat: maplibregl.LngLat) => void
  selectedId?: number | null
  matchingIds?: Set<number> | null
  dynamicPriorities?: Record<number, string> | null
  events?: EventPoint[]
  showEvents?: boolean
  flyTo?: { lng: number; lat: number; zoom?: number }
  className?: string
}

function buildPriorityColor(): maplibregl.ExpressionSpecification {
  return [
    'match',
    ['get', 'priority'],
    'P1 Critical',
    '#DC2626',
    'P1',
    '#DC2626',
    'P2 High',
    '#EA580C',
    'P2',
    '#EA580C',
    'P3 Watch',
    '#D97706',
    'P3',
    '#D97706',
    'P4 Routine',
    '#64748B',
    'P4',
    '#64748B',
    '#64748B',
  ] as maplibregl.ExpressionSpecification
}

const REGIMES = ['R1', 'R2', 'R3', 'R4', 'R5']

function buildRegimeColor(): maplibregl.ExpressionSpecification {
  const expr: unknown[] = ['match', ['slice', ['get', 'regime'], 0, 2]]
  for (const r of REGIMES) {
    expr.push(r, REGIME_COLORS[r] ?? '#94A3B8')
  }
  expr.push('#94A3B8')
  return expr as maplibregl.ExpressionSpecification
}

function buildFillColor(layer: MapLayer): maplibregl.ExpressionSpecification {
  if (layer === 'priority') return buildPriorityColor()
  if (layer === 'regime') return buildRegimeColor()

  if (layer === 'elev_mean') {
    return [
      'interpolate',
      ['linear'],
      ['get', layer],
      500, '#E0F2FE',
      1500, '#7DD3FC',
      3000, '#0369A1',
      5000, '#1E3A5F',
    ] as maplibregl.ExpressionSpecification
  }
  if (layer === 'pop_total') {
    return [
      'interpolate',
      ['linear'],
      ['get', layer],
      0, '#F0FDF4',
      1000, '#86EFAC',
      10000, '#16A34A',
      100000, '#14532D',
    ] as maplibregl.ExpressionSpecification
  }
  if (layer === 'slope_p90') {
    return [
      'interpolate',
      ['linear'],
      ['get', layer],
      15, '#FEF08A',
      30, '#F59E0B',
      45, '#DC2626',
      60, '#7F1D1D',
    ] as maplibregl.ExpressionSpecification
  }
  if (layer === 'watch_mm') {
    return [
      'interpolate',
      ['linear'],
      ['get', layer],
      20, '#BFDBFE',
      45, '#3B82F6',
      70, '#1D4ED8',
      100, '#1E3A8A',
    ] as maplibregl.ExpressionSpecification
  }

  // Continuous 0..1 index (priority_score, exposure_index, hazard_index)
  return [
    'interpolate',
    ['linear'],
    ['get', layer],
    0, '#FFF7ED',
    0.33, '#FED7AA',
    0.66, '#EA580C',
    1, '#7C2D12',
  ] as maplibregl.ExpressionSpecification
}

// Global in-memory cache for fast instant loads across tab switches
export default function FloodMap({
  layer,
  onCatchmentClick,
  selectedId,
  matchingIds,
  dynamicPriorities,
  events,
  showEvents,
  flyTo,
  className = '',
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<maplibregl.Map | null>(null)
  const hoverPopupRef = useRef<maplibregl.Popup | null>(null)
  const baselineGeoJsonRef = useRef<GeoJsonFeatureCollection | null>(null)

  const [isLoadingGeojson, setIsLoadingGeojson] = useState(!hasCachedGeoJson())
  const [isSourceReady, setIsSourceReady] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loadAttempts, setLoadAttempts] = useState(0)

  const updateFillColor = useCallback((map: maplibregl.Map, currentLayer: MapLayer) => {
    if (!map.getLayer('catchments-fill')) return
    map.setPaintProperty('catchments-fill', 'fill-color', buildFillColor(currentLayer))
  }, [])

  // Initialize Map
  useEffect(() => {
    if (!containerRef.current || mapRef.current) return

    let cancelled = false
    setLoadError(null)

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: {
        version: 8,
        sources: {
          osm: {
            type: 'raster',
            tiles: ['https://tile.openstreetmap.org/{z}/{x}/{y}.png'],
            tileSize: 256,
            attribution: '© OpenStreetMap contributors',
          },
        },
        layers: [
          {
            id: 'osm-tiles',
            type: 'raster',
            source: 'osm',
            paint: { 'raster-opacity': 0.35 },
          },
        ],
      },
      center: [78.5, 30.5],
      zoom: 7,
    })

    map.addControl(new maplibregl.NavigationControl({ showCompass: true }), 'top-right')

    map.on('error', () => {
      // Ignore background raster tile transient network errors so they never block polygon rendering
    })

    // Mount catchments directly on map load
    const setupLayers = async () => {
      try {
        const geojson = await preloadGeoJson()
        if (cancelled) return
        baselineGeoJsonRef.current = geojson

        if (!map.getSource('catchments')) {
          map.addSource('catchments', {
            type: 'geojson',
            data: geojson,
            promoteId: 'catchment_id',
          })

          map.addLayer({
            id: 'catchments-fill',
            type: 'fill',
            source: 'catchments',
            paint: {
              'fill-color': buildFillColor(layer),
              'fill-opacity': 0.85,
            },
          })

          map.addLayer({
            id: 'catchments-stroke',
            type: 'line',
            source: 'catchments',
            paint: {
              'line-color': '#FFFFFF',
              'line-width': 0.8,
              'line-opacity': 0.85,
            },
          })

          map.addLayer({
            id: 'catchments-hover',
            type: 'fill',
            source: 'catchments',
            paint: {
              'fill-color': '#1D4ED8',
              'fill-opacity': [
                'case',
                ['boolean', ['feature-state', 'hover'], false],
                0.4,
                0,
              ] as maplibregl.ExpressionSpecification,
            },
          })

          map.addLayer({
            id: 'catchment-selected-fill',
            type: 'fill',
            source: 'catchments',
            filter: ['==', ['get', 'catchment_id'], -1],
            paint: {
              'fill-color': '#2563EB',
              'fill-opacity': 0.3,
            },
          })

          map.addLayer({
            id: 'catchment-selected-stroke',
            type: 'line',
            source: 'catchments',
            filter: ['==', ['get', 'catchment_id'], -1],
            paint: {
              'line-color': '#2563EB',
              'line-width': 3.5,
              'line-opacity': 1,
            },
          })

          map.addSource('events', {
            type: 'geojson',
            data: { type: 'FeatureCollection', features: [] },
          })

          map.addLayer({
            id: 'events-circle',
            type: 'circle',
            source: 'events',
            layout: { visibility: 'none' },
            paint: {
              'circle-radius': 5,
              'circle-color': [
                'match',
                ['get', 'precision'],
                'town',
                '#1D4ED8',
                '#F59E0B',
              ] as maplibregl.ExpressionSpecification,
              'circle-stroke-width': 1.5,
              'circle-stroke-color': '#FFFFFF',
            },
          })

          setIsLoadingGeojson(false)
          setIsSourceReady(true)
        }
      } catch (err: unknown) {
        if (cancelled) return
        const msg = err instanceof Error ? err.message : 'Failed to load catchment boundary data.'
        setLoadError(msg)
        setIsLoadingGeojson(false)
      }
    }

    let setupCalled = false
    const trySetup = () => {
      if (setupCalled) return
      setupCalled = true
      setupLayers()
    }

    if (map.isStyleLoaded() || map.loaded()) {
      trySetup()
    } else {
      map.once('style.load', trySetup)
      map.once('load', trySetup)
      map.on('styledata', () => {
        if (map.isStyleLoaded()) trySetup()
      })
    }

    // Hover popup
    const hoverPopup = new maplibregl.Popup({
      closeButton: false,
      closeOnClick: false,
      offset: 12,
    })
    hoverPopupRef.current = hoverPopup

    let hoveredId: string | number | null = null

    map.on('mousemove', 'catchments-fill', e => {
      map.getCanvas().style.cursor = 'pointer'
      if (e.features && e.features.length > 0) {
        const feat = e.features[0]
        const cid = feat.properties?.catchment_id as number | undefined

        if (hoveredId !== null && hoveredId !== cid) {
          map.setFeatureState({ source: 'catchments', id: hoveredId }, { hover: false })
        }

        if (cid !== undefined) {
          hoveredId = cid
          map.setFeatureState({ source: 'catchments', id: cid }, { hover: true })

          const pri = String(feat.properties?.priority ?? 'P4 Routine')
          const reg = String(feat.properties?.regime ?? '').split(' ')[0]
          const score = feat.properties?.priority_score != null ? Number(feat.properties.priority_score).toFixed(3) : ''

          hoverPopup
            .setLngLat(e.lngLat)
            .setHTML(
              `<div class="text-xs">
                <span class="font-bold text-gray-900">Catchment #${cid}</span>
                <span class="mx-1 text-gray-400">·</span>
                <span class="font-medium" style="color: ${PRIORITY_COLORS[pri] ?? '#64748B'}">${pri.split(' ')[0]}</span>
                ${reg ? `<span class="mx-1 text-gray-400">·</span><span class="text-gray-600">${reg}</span>` : ''}
                ${score ? `<br><span class="text-gray-500">Score: ${score}</span>` : ''}
              </div>`
            )
            .addTo(map)
        }
      }
    })

    map.on('mouseleave', 'catchments-fill', () => {
      map.getCanvas().style.cursor = ''
      if (hoveredId !== null) {
        map.setFeatureState({ source: 'catchments', id: hoveredId }, { hover: false })
        hoveredId = null
      }
      hoverPopup.remove()
    })

    map.on('click', 'catchments-fill', e => {
      if (!e.features || !e.features.length) return
      const props = e.features[0].properties as Record<string, unknown>
      const id = props?.catchment_id as number | undefined
      if (id !== undefined && onCatchmentClick) {
        onCatchmentClick(id, e.lngLat)
      }
    })

    const resizeObserver = new ResizeObserver(() => {
      map.resize()
    })
    if (containerRef.current) {
      resizeObserver.observe(containerRef.current)
    }

    mapRef.current = map

    return () => {
      cancelled = true
      resizeObserver.disconnect()
      map.remove()
      mapRef.current = null
      baselineGeoJsonRef.current = null
      setIsSourceReady(false)
    }
  }, [loadAttempts]) // eslint-disable-line react-hooks/exhaustive-deps

  // Update fill color expression when layer changes
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    if (map.isStyleLoaded()) {
      updateFillColor(map, layer)
    } else {
      map.once('idle', () => updateFillColor(map, layer))
    }
  }, [layer, updateFillColor])

  const isOverriddenRef = useRef(false)

  // Update Dynamic Priorities (Priority Builder Synchronisation)
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const source = map.getSource('catchments') as maplibregl.GeoJSONSource | undefined
    if (!source || !baselineGeoJsonRef.current) return

    if (dynamicPriorities && Object.keys(dynamicPriorities).length > 0) {
      isOverriddenRef.current = true
      // Re-map priorities for features
      const updated: GeoJsonFeatureCollection = {
        ...baselineGeoJsonRef.current,
        features: baselineGeoJsonRef.current.features.map((f: GeoJsonFeature) => {
          const cid = f.properties?.catchment_id as number
          const newPri = dynamicPriorities[cid]
          if (newPri && newPri !== f.properties?.priority) {
            return {
              ...f,
              properties: {
                ...f.properties,
                priority: newPri,
              },
            }
          }
          return f
        }),
      }
      source.setData(updated)
    } else if (isOverriddenRef.current) {
      // Only restore if previously overridden
      isOverriddenRef.current = false
      source.setData(baselineGeoJsonRef.current)
    }
  }, [dynamicPriorities, isSourceReady])

  // Update Selection Highlight Layer
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('catchment-selected-stroke')) return

    if (selectedId != null && !isNaN(selectedId)) {
      map.setFilter('catchment-selected-fill', ['==', ['get', 'catchment_id'], selectedId])
      map.setFilter('catchment-selected-stroke', ['==', ['get', 'catchment_id'], selectedId])
    } else {
      map.setFilter('catchment-selected-fill', ['==', ['get', 'catchment_id'], -1])
      map.setFilter('catchment-selected-stroke', ['==', ['get', 'catchment_id'], -1])
    }
  }, [selectedId, isSourceReady])

  // Update Dimming / Filtering Opacity
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getLayer('catchments-fill') || !map.getLayer('catchments-stroke')) return

    if (matchingIds !== null && matchingIds !== undefined) {
      if (matchingIds.size === 0) {
        // No match
        map.setPaintProperty('catchments-fill', 'fill-opacity', 0.05)
        map.setPaintProperty('catchments-stroke', 'line-opacity', 0.05)
      } else {
        const arr = [...matchingIds]
        map.setPaintProperty('catchments-fill', 'fill-opacity', [
          'case',
          ['in', ['get', 'catchment_id'], ['literal', arr]],
          0.85,
          0.06,
        ] as maplibregl.ExpressionSpecification)
        map.setPaintProperty('catchments-stroke', 'line-opacity', [
          'case',
          ['in', ['get', 'catchment_id'], ['literal', arr]],
          0.9,
          0.06,
        ] as maplibregl.ExpressionSpecification)
      }
    } else {
      map.setPaintProperty('catchments-fill', 'fill-opacity', 0.85)
      map.setPaintProperty('catchments-stroke', 'line-opacity', 0.85)
    }
  }, [matchingIds, isSourceReady])

  // Handle Event Points
  useEffect(() => {
    const map = mapRef.current
    if (!map || !map.getSource('events')) return

    const features = (events ?? []).map(ev => ({
      type: 'Feature' as const,
      geometry: { type: 'Point' as const, coordinates: [ev.lon, ev.lat] as [number, number] },
      properties: { location: ev.location, date: ev.date, precision: ev.precision },
    }))

    const source = map.getSource('events') as maplibregl.GeoJSONSource
    source.setData({ type: 'FeatureCollection', features })

    if (map.getLayer('events-circle')) {
      map.setLayoutProperty('events-circle', 'visibility', showEvents ? 'visible' : 'none')
    }
  }, [events, showEvents, isSourceReady])

  // Smooth Map Fly-To
  useEffect(() => {
    const map = mapRef.current
    if (!map || !flyTo) return
    map.flyTo({ center: [flyTo.lng, flyTo.lat], zoom: flyTo.zoom ?? 11, essential: true })
  }, [flyTo])

  return (
    <div className={`relative w-full h-full ${className}`}>
      <div
        ref={containerRef}
        className="w-full h-full"
        role="application"
        aria-label="Himalayan catchment map"
      />

      {/* Loading Indicator */}
      {isLoadingGeojson && (
        <div className="absolute inset-0 bg-white/70 backdrop-blur-xs flex items-center justify-center z-20">
          <div className="bg-white border border-gray-200 rounded-lg shadow-sm px-4 py-2.5 flex items-center gap-2 text-xs text-gray-700">
            <RefreshCw size={14} className="animate-spin text-accent" />
            <span>Loading 3,067 micro-catchments…</span>
          </div>
        </div>
      )}

      {/* Error Banner with Retry */}
      {loadError && (
        <div className="absolute top-4 left-4 right-4 z-30 bg-red-50 border border-red-200 rounded-lg p-3 shadow-md flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-red-800">
            <AlertCircle size={16} className="text-red-600 flex-shrink-0" />
            <span>{loadError}</span>
          </div>
          <button
            onClick={() => setLoadAttempts(a => a + 1)}
            className="btn-secondary text-xs py-1 px-2.5 flex items-center gap-1 text-red-700 border-red-200 hover:bg-red-100"
          >
            <RefreshCw size={12} /> Retry
          </button>
        </div>
      )}
    </div>
  )
}
