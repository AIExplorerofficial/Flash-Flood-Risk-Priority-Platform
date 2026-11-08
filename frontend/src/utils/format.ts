// Shared formatting and color utilities

export function formatNumber(n: number, decimals = 0): string {
  return new Intl.NumberFormat('en-IN', {
    maximumFractionDigits: decimals,
    minimumFractionDigits: decimals,
  }).format(n)
}

export function formatPop(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)} M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)} K`
  return formatNumber(n)
}

export function formatArea(km2: number): string {
  return `${formatNumber(km2, 1)} km²`
}

export function formatMm(mm: number): string {
  return `${mm.toFixed(1)} mm/d`
}

export const PRIORITY_COLORS: Record<string, string> = {
  'P1 Critical': '#DC2626',
  'P2 High': '#EA580C',
  'P3 Watch': '#D97706',
  'P4 Routine': '#64748B',
}

export const PRIORITY_SHORT: Record<string, string> = {
  'P1 Critical': 'P1',
  'P2 High': 'P2',
  'P3 Watch': 'P3',
  'P4 Routine': 'P4',
}

export const REGIME_COLORS: Record<string, string> = {
  R1: '#94A3B8',
  R2: '#78716C',
  R3: '#059669',
  R4: '#D97706',
  R5: '#B91C1C',
}

export const REGIME_LABELS: Record<string, string> = {
  'R1 alpine/cold-arid, low rain extremes, very steep slopes': 'R1',
  'R2 alpine/cold-arid, low rain extremes, steep slopes': 'R2',
  'R3 mid-hill, high rain extremes, gentle slopes': 'R3',
  'R4 mid-hill, moderate rain extremes, steep slopes': 'R4',
  'R5 alpine/cold-arid, moderate rain extremes, very steep slopes': 'R5',
}

export function regimeKey(regime: string): string {
  return regime.split(' ')[0]
}

export function regimeColor(regime: string): string {
  return REGIME_COLORS[regimeKey(regime)] ?? '#94A3B8'
}

export function priorityColor(priority: string): string {
  return PRIORITY_COLORS[priority] ?? '#64748B'
}

export function priorityPillClass(priority: string): string {
  if (priority.startsWith('P1')) return 'pill-p1'
  if (priority.startsWith('P2')) return 'pill-p2'
  if (priority.startsWith('P3')) return 'pill-p3'
  return 'pill-p4'
}

export const DEFAULT_RANK_WEIGHTS = {
  weight_slope_p90: 1,
  weight_melton: 1,
  weight_drainage_density: 1,
  weight_inv_tc_min: 1,
  weight_p99_wetday: 1,
  weight_max3d: 1,
  weight_heavy_days: 1,
  response_rainfall_balance: 0.5,
  exposure_weight: 1,
  belt_min: 500,
  belt_max: 3500,
  p1_pct: 0.05,
  p2_pct: 0.05,
}

export const PRIORITY_ORDER = ['P1 Critical', 'P2 High', 'P3 Watch', 'P4 Routine']

export const REGIMES_ORDER = [
  'R1 alpine/cold-arid, low rain extremes, very steep slopes',
  'R2 alpine/cold-arid, low rain extremes, steep slopes',
  'R3 mid-hill, high rain extremes, gentle slopes',
  'R4 mid-hill, moderate rain extremes, steep slopes',
  'R5 alpine/cold-arid, moderate rain extremes, very steep slopes',
]
