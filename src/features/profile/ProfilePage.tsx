import { Link } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ProgressCard } from './ProgressCard'
import { StatsCard } from './StatsCard'
import { WeightCard } from './WeightCard'

export function ProfilePage() {
  const { profile } = useAuth()
  return (
    <section className="page">
      <h1>{profile?.username ?? 'Profil'}</h1>
      <ProgressCard />
      <StatsCard />
      <div className="grid-2 profile-links">
        <Link className="btn" to="/historique">📅 Mon historique</Link>
        <Link className="btn" to="/records">🏆 Mes records</Link>
      </div>
      <WeightCard />
    </section>
  )
}
