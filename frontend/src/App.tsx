import { Routes, Route } from 'react-router-dom'
import AppShell from './components/AppShell'
import Overview from './pages/Overview'
import MapExplorer from './pages/MapExplorer'
import Regimes from './pages/Regimes'
import PriorityBuilder from './pages/PriorityBuilder'
import Validation from './pages/Validation'
import ActionPlanner from './pages/ActionPlanner'
import AlertLevels from './pages/AlertLevels'
import DataMethod from './pages/DataMethod'
import { preloadGeoJson } from './api/geojson'

// Eagerly prefetch 3,067 catchment boundaries into memory for instant map loads
preloadGeoJson().catch(() => {})

export default function App() {
  return (
    <AppShell>
      <Routes>
        <Route path="/" element={<Overview />} />
        <Route path="/explorer" element={<MapExplorer />} />
        <Route path="/regimes" element={<Regimes />} />
        <Route path="/builder" element={<PriorityBuilder />} />
        <Route path="/validation" element={<Validation />} />
        <Route path="/planner" element={<ActionPlanner />} />
        <Route path="/alerts" element={<AlertLevels />} />
        <Route path="/method" element={<DataMethod />} />
      </Routes>
    </AppShell>
  )
}
