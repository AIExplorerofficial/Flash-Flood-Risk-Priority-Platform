import { NavLink, useNavigate } from 'react-router-dom'
import {
  Map, BarChart2, Layers, Sliders, CheckSquare,
  List, Bell, FileText, Mountain, Search, Download, Loader2
} from 'lucide-react'
import { useState, useRef, useEffect, type KeyboardEvent } from 'react'
import { api } from '../api/client'
import { PriorityPill } from './PriorityPill'
import type { CatchmentRow } from '../api/types'

const NAV_SECTIONS = [
  {
    label: 'ANALYSIS',
    items: [
      { to: '/', icon: <BarChart2 size={16} />, label: 'Overview' },
      { to: '/explorer', icon: <Map size={16} />, label: 'Map Explorer' },
      { to: '/regimes', icon: <Layers size={16} />, label: 'Regimes' },
    ],
  },
  {
    label: 'TOOLS',
    items: [
      { to: '/builder', icon: <Sliders size={16} />, label: 'Priority Builder' },
      { to: '/validation', icon: <CheckSquare size={16} />, label: 'Validation' },
      { to: '/planner', icon: <List size={16} />, label: 'Action Planner' },
    ],
  },
  {
    label: 'REFERENCE',
    items: [
      { to: '/alerts', icon: <Bell size={16} />, label: 'Alert Levels' },
      { to: '/method', icon: <FileText size={16} />, label: 'Data & Method' },
    ],
  },
]

interface Props {
  children: React.ReactNode
}

export default function AppShell({ children }: Props) {
  const [searchVal, setSearchVal] = useState('')
  const [suggestions, setSuggestions] = useState<CatchmentRow[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const [selectedIndex, setSelectedIndex] = useState(-1)

  const searchContainerRef = useRef<HTMLDivElement>(null)
  const queryCounterRef = useRef(0)
  const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const navigate = useNavigate()

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchContainerRef.current && !searchContainerRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [])

  function handleInputChange(value: string) {
    setSearchVal(value)
    setSelectedIndex(-1)
    const trimmed = value.trim()

    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current)
    }

    if (!trimmed) {
      setSuggestions([])
      setIsOpen(false)
      setIsLoading(false)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setIsOpen(true)
    setHasSearched(false)

    const thisQueryId = ++queryCounterRef.current

    debounceTimerRef.current = setTimeout(async () => {
      try {
        const res = await api.catchments({ search: trimmed, page_size: 8 })
        if (thisQueryId === queryCounterRef.current) {
          setSuggestions(res.rows)
          setIsLoading(false)
          setHasSearched(true)
        }
      } catch {
        if (thisQueryId === queryCounterRef.current) {
          setSuggestions([])
          setIsLoading(false)
          setHasSearched(true)
        }
      }
    }, 200)
  }

  function selectCatchment(id: string | number) {
    setIsOpen(false)
    setSearchVal('')
    navigate(`/explorer?search=${encodeURIComponent(id)}`)
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>) {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (!isOpen && suggestions.length > 0) {
        setIsOpen(true)
      }
      setSelectedIndex(prev => (prev < suggestions.length - 1 ? prev + 1 : prev))
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(prev => (prev > -1 ? prev - 1 : -1))
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (selectedIndex >= 0 && suggestions[selectedIndex]) {
        selectCatchment(suggestions[selectedIndex].catchment_id)
      } else if (suggestions.length > 0) {
        selectCatchment(suggestions[0].catchment_id)
      } else if (searchVal.trim()) {
        selectCatchment(searchVal.trim())
      }
    }
  }

  return (
    <div className="flex h-screen bg-gray-50 overflow-hidden">
      {/* Left Navigation Rail */}
      <aside className="w-56 bg-white border-r border-gray-200 flex flex-col flex-shrink-0">
        {/* Logo */}
        <div className="px-4 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Mountain size={20} className="text-accent" aria-hidden="true" />
            <div>
              <div className="text-sm font-semibold text-gray-900 leading-tight">HimFlood</div>
              <div className="text-xs text-gray-500">Priority Platform</div>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-3 px-2" aria-label="Main navigation">
          {NAV_SECTIONS.map(section => (
            <div key={section.label} className="mb-4">
              <div className="px-3 py-1 text-xs font-semibold text-gray-400 tracking-wider uppercase">
                {section.label}
              </div>
              {section.items.map(item => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  end={item.to === '/'}
                  className={({ isActive }) =>
                    `nav-link ${isActive ? 'active' : ''}`
                  }
                >
                  {item.icon}
                  <span>{item.label}</span>
                </NavLink>
              ))}
            </div>
          ))}
        </nav>

        {/* Footer */}
        <div className="px-4 py-3 border-t border-gray-200">
          <div className="text-xs text-gray-400">Uttarakhand + HP</div>
          <div className="text-xs text-gray-400">3,067 catchments</div>
        </div>
      </aside>

      {/* Main Area */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Top Bar */}
        <header className="bg-white border-b border-gray-200 px-4 py-2 flex items-center gap-3 flex-shrink-0 z-30">
          <div ref={searchContainerRef} className="relative flex-1 max-w-md">
            <div className="relative">
              <Search
                size={14}
                className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
                aria-hidden="true"
              />
              <input
                type="search"
                placeholder="Search catchment ID (e.g. 1847)…"
                value={searchVal}
                onChange={e => handleInputChange(e.target.value)}
                onKeyDown={handleKeyDown}
                onFocus={() => {
                  if (suggestions.length > 0 || hasSearched) setIsOpen(true)
                }}
                aria-label="Search catchment by ID"
                aria-autocomplete="list"
                aria-expanded={isOpen}
                className="w-full pl-8 pr-8 py-1.5 text-sm border border-gray-300 rounded-md bg-gray-50 focus:bg-white focus:border-accent transition-colors duration-150"
              />
              {isLoading && (
                <Loader2
                  size={14}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-accent animate-spin"
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Suggestions Dropdown */}
            {isOpen && (
              <div
                className="absolute left-0 right-0 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden z-50 max-h-80 overflow-y-auto"
                role="listbox"
              >
                {isLoading ? (
                  <div className="p-3 text-xs text-gray-500 flex items-center gap-2">
                    <Loader2 size={13} className="animate-spin text-accent" /> Searching 3,067 catchments…
                  </div>
                ) : suggestions.length > 0 ? (
                  <div className="py-1">
                    <div className="px-3 py-1 text-[11px] font-medium text-gray-400 border-b border-gray-100 uppercase tracking-wider">
                      Matching Catchments ({suggestions.length})
                    </div>
                    {suggestions.map((c, i) => (
                      <div
                        key={c.catchment_id}
                        onClick={() => selectCatchment(c.catchment_id)}
                        onMouseEnter={() => setSelectedIndex(i)}
                        role="option"
                        aria-selected={i === selectedIndex}
                        className={`px-3 py-2 flex items-center justify-between text-xs cursor-pointer border-b border-gray-50 last:border-0 transition-colors ${
                          i === selectedIndex ? 'bg-blue-50 text-accent' : 'hover:bg-gray-50'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-semibold text-gray-900">#{c.catchment_id}</span>
                          <span className="text-gray-500 truncate max-w-[140px] text-[11px]">
                            {c.regime.split(' ')[0]}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 flex-shrink-0">
                          <span className="text-gray-500 tabular-nums">Score {c.priority_score.toFixed(3)}</span>
                          <PriorityPill priority={c.priority} />
                        </div>
                      </div>
                    ))}
                  </div>
                ) : hasSearched ? (
                  <div className="p-4 text-xs text-center text-gray-500">
                    No catchment found matching <span className="font-semibold text-gray-700">"{searchVal}"</span>
                  </div>
                ) : null}
              </div>
            )}
          </div>

          <div className="ml-auto flex items-center gap-2 text-xs text-gray-500">
            <span>Uttarakhand + Himachal Pradesh</span>
            <span className="text-gray-300">|</span>
            <a
              href="/api/geojson"
              download="catchments.geojson"
              className="flex items-center gap-1 text-accent hover:underline"
              aria-label="Download GeoJSON"
            >
              <Download size={13} aria-hidden="true" />
              GeoJSON
            </a>
          </div>
        </header>

        {/* Content */}
        <main className="flex-1 overflow-y-auto" id="main-content">
          {children}
        </main>
      </div>
    </div>
  )
}
