import { useState } from 'react'
import { db } from '../../data/db'
import { updateProfile } from '../../data/profile'
import { supabase } from '../../data/supabase'
import { useSyncStatus } from '../../data/sync'
import { useLive } from '../../data/useLive'
import { setsOf } from '../../data/workouts'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import type { Workout } from '../../domain/types'
import { useAuth, useUserId } from '../auth/AuthProvider'
import { SettingsSection } from './SettingsSection'
import { NeedsCard } from './NeedsCard'
import { KIND_LABELS, setKind } from '../../domain/methods'

export function ProfilePage() {
  const userId = useUserId()
  const { profile, refreshProfile, signOut } = useAuth()
  const { pending } = useSyncStatus()
  const [open, setOpen] = useState<Workout | null>(null)

  const history = useLive(async () => {
    const done = await db.workouts.where('user_id').equals(userId).filter((w) => w.status === 'done').toArray()
    done.sort((a, b) => (b.finished_at ?? '').localeCompare(a.finished_at ?? ''))
    return Promise.all(done.slice(0, 50).map(async (w) => {
      const sets = await setsOf(w.id)
      return { workout: w, exercises: new Set(sets.map((s) => s.exercise_id)).size }
    }))
  }, [userId])

  async function remove() {
    const { error } = await supabase.rpc('delete_my_account')
    if (error) { alert('Suppression impossible. Vérifie ta connexion.'); return }
    await signOut()
  }

  return (
    <section className="page">
      <h1>{profile?.username ?? 'Profil'}</h1>
      <NeedsCard />

      <h2>Mes séances</h2>
      {history?.length === 0 && <p className="muted">Aucune séance terminée pour l’instant.</p>}
      <ul className="list">
        {history?.map(({ workout, exercises }) => (
          <li key={workout.id}>
            <button className="list-item" onClick={() => setOpen(workout)}>
              <span>
                <strong>{workout.name}</strong><br />
                <span className="muted small">
                  {new Date(workout.finished_at!).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                  {' · '}{exercises} exercice{exercises > 1 ? 's' : ''}
                  {' · '}{Math.round((new Date(workout.finished_at!).getTime() - new Date(workout.started_at).getTime()) / 60_000)} min
                </span>
              </span>
              <span className="muted">›</span>
            </button>
          </li>
        ))}
      </ul>

      {profile && (
        <SettingsSection key={profile.username} profile={profile} pending={pending}
          update={async (changes) => {
            const res = await updateProfile(userId, changes)
            if (!res.error) await refreshProfile()
            return res
          }}
          onSignOut={() => void signOut()} onDelete={remove} />
      )}
      {open && <MyWorkoutDetail workout={open} onClose={() => setOpen(null)} />}
    </section>
  )
}

function MyWorkoutDetail({ workout, onClose }: { workout: Workout; onClose(): void }) {
  const { show } = useUnit()
  const rows = useLive(async () => {
    const sets = await setsOf(workout.id)
    const ids = [...new Set(sets.map((s) => s.exercise_id))]
    const exercises = await db.exercises.bulkGet(ids)
    return ids.map((id, i) => ({ id, name: exercises[i]?.name ?? 'Exercice', sets: sets.filter((s) => s.exercise_id === id && s.done) }))
  }, [workout.id])
  return (
    <Sheet title={workout.name} onClose={onClose}>
      {rows?.map((ex) => (
        <div key={ex.id} className="card">
          <p className="card-title">{ex.name}</p>
          {ex.sets.length === 0
            ? <p className="muted small">Aucune série validée</p>
            : <ul className="list num">{ex.sets.map((s, i) => <li key={s.id} className="small">{i + 1}. {setKind(s) !== 'work' && <span className={`tag tag-${setKind(s)}`}>{KIND_LABELS[setKind(s)]}</span>} {show(s.weight)} × {s.reps}</li>)}</ul>}
        </div>
      ))}
    </Sheet>
  )
}
