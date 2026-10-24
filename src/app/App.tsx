import { Link, Route, Routes } from 'react-router-dom'
import { TabBar } from './TabBar'
import { SessionPage } from '../features/session/SessionPage'
import { ProgramsPage } from '../features/programs/ProgramsPage'
import { ExercisesPage } from '../features/exercises/ExercisesPage'
import { FriendsPage } from '../features/friends/FriendsPage'
import { ProfilePage } from '../features/profile/ProfilePage'

export function AppRoutes() {
  return (
    <div className="shell">
      <header className="topbar">
        <span className="brand">Muscu</span>
        <Link to="/profil" className="topbar-profile" aria-label="Profil">Profil</Link>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<SessionPage />} />
          <Route path="/programmes" element={<ProgramsPage />} />
          <Route path="/exercices" element={<ExercisesPage />} />
          <Route path="/amis" element={<FriendsPage />} />
          <Route path="/profil" element={<ProfilePage />} />
        </Routes>
      </main>
      <TabBar />
    </div>
  )
}

export function App() {
  return <AppRoutes />
}
