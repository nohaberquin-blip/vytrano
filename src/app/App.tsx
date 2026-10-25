import { Link, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { TabBar } from './TabBar'
import { SessionPage } from '../features/session/SessionPage'
import { ProgramsPage } from '../features/programs/ProgramsPage'
import { CalendarPage } from '../features/calendar/CalendarPage'
import { ExercisesPage } from '../features/exercises/ExercisesPage'
import { FriendsPage } from '../features/friends/FriendsPage'
import { ProfilePage } from '../features/profile/ProfilePage'
import { RecordsPage } from '../features/records/RecordsPage'
import { AuthProvider, useAuth } from '../features/auth/AuthProvider'
import { LoginPage } from '../features/auth/LoginPage'
import { OnboardingPage } from '../features/auth/OnboardingPage'
import { NewPasswordPage } from '../features/auth/NewPasswordPage'
import { isProvisionalUsername } from '../data/profile'
import { supabaseConfigured } from '../data/supabase'
import type { ReactNode } from 'react'
import { UnitContext } from './units'
import { SyncBadge } from './SyncBadge'
import { useIncomingRequests } from '../features/friends/useIncomingRequests'
import { GlobalRestBar, RestProvider } from '../features/session/RestProvider'

export function AppRoutes({ headerExtra, badges }: { headerExtra?: ReactNode; badges?: Record<string, number> }) {
  return (
    <RestProvider>
    <div className="shell">
      <header className="topbar">
        <span className="brand">Vytrano</span>
        <div className="topbar-right">
          {headerExtra}
          <Link to="/profil" className="topbar-profile" aria-label="Profil">Profil</Link>
        </div>
      </header>
      <main className="content">
        <Routes>
          <Route path="/" element={<SessionPage />} />
          <Route path="/calendrier" element={<CalendarPage />} />
          <Route path="/programmes" element={<ProgramsPage />} />
          <Route path="/exercices" element={<ExercisesPage />} />
          <Route path="/amis" element={<FriendsPage />} />
          <Route path="/profil" element={<ProfilePage />} />
          <Route path="/records" element={<RecordsPage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <GlobalRestBar />
      <TabBar badges={badges} />
    </div>
    </RestProvider>
  )
}

function Gate() {
  const { loading, user, profile, recovering } = useAuth()
  const location = useLocation()
  const { count: incoming } = useIncomingRequests()
  if (loading) return <div className="empty">Chargement…</div>
  if (!user) return <LoginPage />
  if (recovering) return <NewPasswordPage />
  if (profile && isProvisionalUsername(profile.username)) return <OnboardingPage />
  if (location.pathname === '/bienvenue') return <Navigate to="/" replace />
  return (
    <UnitContext.Provider value={profile?.unit ?? 'kg'}>
      <AppRoutes badges={{ '/amis': incoming }} headerExtra={<SyncBadge />} />
    </UnitContext.Provider>
  )
}

function NotConfigured() {
  return (
    <div className="auth">
      <span className="brand">Vytrano</span>
      <h1>Configuration manquante</h1>
      <p className="muted">
        Renseigne <code>VITE_SUPABASE_URL</code> et <code>VITE_SUPABASE_ANON_KEY</code> dans <code>.env.local</code>,
        puis relance <code>npm run dev</code>. Voir <code>docs/SETUP.md</code>.
      </p>
    </div>
  )
}

export function App() {
  if (!supabaseConfigured) return <NotConfigured />
  return (
    <AuthProvider>
      <Gate />
    </AuthProvider>
  )
}
