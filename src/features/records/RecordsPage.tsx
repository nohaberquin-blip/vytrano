import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useUnit } from '../../app/units'
import { db } from '../../data/db'
import { allRecords } from '../../data/records'
import { repo } from '../../data/repo'
import { useLive } from '../../data/useLive'
import { useUserId } from '../auth/AuthProvider'
import { ExerciseSheet } from '../exercises/ExerciseSheet'

const longDate = (date: string) => new Date(`${date}T12:00:00`).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })

/** « Mes records » : charge max et 1RM estimé de chaque exercice pratiqué, record le plus récent en haut. */
export function RecordsPage() {
  const userId = useUserId()
  const { show } = useUnit()
  const records = useLive(() => allRecords(userId), [userId])
  const [openId, setOpenId] = useState<string | null>(null)
  const open = useLive(async () => {
    if (!openId) return null
    const [exercise, fiche] = await Promise.all([
      db.exercises.get(openId),
      db.user_exercises.where('exercise_id').equals(openId).filter((f) => f.user_id === userId).first(),
    ])
    return exercise && fiche ? { exercise, fiche } : null
  }, [openId, userId])

  return (
    <section className="page">
      <Link className="muted small" to="/profil">‹ Profil</Link>
      <h1>🏆 Mes records</h1>
      {records?.length === 0 && <p className="muted">Termine une séance pour voir tes records.</p>}
      <ul className="list">
        {records?.map((r) => (
          <li key={r.exerciseId}>
            <button className="list-item" onClick={() => setOpenId(r.exerciseId)}>
              <span>
                <strong>{r.name}</strong><br />
                <span className="small num">Charge max {show(r.weight.value)} · 1RM estimé {show(r.e1rm.value)}</span><br />
                <span className="muted small">
                  {r.lastRecord ? `Dernier record : ${longDate(r.lastRecord)}` : `Première séance : ${longDate(r.weight.date)}`}
                </span>
              </span>
              <span className="muted">›</span>
            </button>
          </li>
        ))}
      </ul>
      {open && (
        <ExerciseSheet key={open.fiche.id} exercise={open.exercise} fiche={open.fiche}
          save={(f) => repo.put('user_exercises', f)} onClose={() => setOpenId(null)} />
      )}
    </section>
  )
}
