import { useState } from 'react'
import { db } from '../../data/db'
import { ensureFiche, repo } from '../../data/repo'
import { useLive } from '../../data/useLive'
import { Sheet } from '../../app/Sheet'
import { useUnit } from '../../app/units'
import { formatWeight } from '../../domain/parseWeight'
import { BODY_PARTS, toBodyPart } from '../../domain/bodyParts'
import { useUserId } from '../auth/AuthProvider'
import { ExercisePicker } from './ExercisePicker'
import { ExerciseSheet } from './ExerciseSheet'

export function ExercisesPage() {
  const userId = useUserId()
  const { show, toDisplay } = useUnit()
  const [openId, setOpenId] = useState<string | null>(null)
  const [picking, setPicking] = useState(false)

  const rows = useLive(async () => {
    const fiches = await db.user_exercises.where('user_id').equals(userId).toArray()
    const exercises = await db.exercises.bulkGet(fiches.map((f) => f.exercise_id))
    return fiches
      .map((f, i) => ({ fiche: f, exercise: exercises[i] }))
      .filter((r) => r.exercise)
      .sort((a, b) => a.exercise!.name.localeCompare(b.exercise!.name, 'fr'))
  }, [userId])

  const open = rows?.find((r) => r.fiche.id === openId)

  return (
    <section className="page">
      <div className="row between">
        <h1>Mes exercices</h1>
        <button className="btn primary" onClick={() => setPicking(true)}>＋ Ajouter</button>
      </div>
      {rows && rows.length === 0 && (
        <p className="empty">Aucun exercice pour l’instant. Ajoute-en un, ou crée un programme : ses exercices apparaîtront ici.</p>
      )}
      {BODY_PARTS.map((part) => {
        const items = rows?.filter((r) => toBodyPart(r.exercise!.muscle_group) === part) ?? []
        if (items.length === 0) return null
        return (
          <section key={part} aria-label={part}>
            <h3 className="group-title">{part}</h3>
            <ul className="list">
              {items.map(({ fiche, exercise }) => (
                <li key={fiche.id}>
                  <button className="list-item" onClick={() => setOpenId(fiche.id)}>
                    <span>
                      <strong>{exercise!.name}</strong><br />
                      <span className="muted small num">
                        {fiche.sets} × {fiche.target_reps} · {show(fiche.current_weight)} · +{formatWeight(toDisplay(fiche.increment))}
                      </span>
                    </span>
                    <span className="muted">›</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )
      })}

      {open && (
        <ExerciseSheet key={open.fiche.id} exercise={open.exercise!} fiche={open.fiche}
          save={(f) => repo.put('user_exercises', f)} onClose={() => setOpenId(null)}
          onRemove={async () => {
            if (!confirm(`Retirer « ${open.exercise!.name} » de tes exercices ? Ses réglages seront perdus.`)) return
            await repo.remove('user_exercises', open.fiche.id)
            setOpenId(null)
          }} />
      )}
      {picking && (
        <Sheet title="Ajouter un exercice" onClose={() => setPicking(false)}>
          <ExercisePicker exclude={rows?.map((r) => r.exercise!.id)} onPick={async (e) => {
            const f = await ensureFiche(userId, e.id)
            setPicking(false)
            setOpenId(f.id)
          }} />
        </Sheet>
      )}
    </section>
  )
}
