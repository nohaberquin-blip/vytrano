import { useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { db } from '../../data/db'
import {
  addDay, addDayExercise, deleteDay, deleteProgram, getProgramTree, moveDay, moveDayExercise,
  removeDayExercise, renameDay, renameProgram, setActiveProgram,
} from '../../data/programs'
import { useLive } from '../../data/useLive'
import { useUserId } from '../auth/AuthProvider'
import { ExercisePicker } from '../exercises/ExercisePicker'
import { ShareDialog } from './ShareDialog'

export function ProgramEditor({ programId, onBack }: { programId: string; onBack(): void }) {
  const userId = useUserId()
  const tree = useLive(() => getProgramTree(programId), [programId])
  const names = useLive(async () => new Map((await db.exercises.toArray()).map((e) => [e.id, e.name])), []) ?? new Map()
  const [pickingFor, setPickingFor] = useState<string | null>(null)
  const [sharing, setSharing] = useState(false)

  if (tree === undefined) return null
  if (tree === null) return <p className="empty">Programme introuvable. <button className="btn" onClick={onBack}>Retour</button></p>
  const { program, days, exercisesByDay } = tree

  async function remove() {
    if (!confirm(`Supprimer « ${program.name} » ? Ton historique de séances est conservé.`)) return
    await deleteProgram(userId, program.id)
    onBack()
  }

  return (
    <section className="page">
      <button className="btn ghost" onClick={onBack} style={{ paddingLeft: 0 }}>‹ Programmes</button>
      <input className="input" aria-label="Nom du programme" defaultValue={program.name} key={program.id}
        style={{ fontSize: 22, fontWeight: 750, margin: '8px 0 12px' }}
        onBlur={(e) => e.target.value.trim() && e.target.value !== program.name && renameProgram(program.id, e.target.value.trim())} />
      <div className="row" style={{ flexWrap: 'wrap', marginBottom: 12 }}>
        {program.is_active
          ? <span className="pill">Programme actif</span>
          : <button className="btn primary" onClick={() => setActiveProgram(userId, program.id)}>Suivre ce programme</button>}
        <button className="btn" onClick={() => setSharing(true)}>Partager</button>
      </div>

      {days.length === 0 && <p className="empty">Ajoute un premier jour, par exemple « Push » ou « Jour A ».</p>}
      {days.map((day, i) => (
        <div className="card" key={day.id}>
          <div className="row">
            <input className="input" aria-label="Nom du jour" defaultValue={day.name} style={{ fontWeight: 700 }}
              onBlur={(e) => e.target.value.trim() && e.target.value !== day.name && renameDay(day.id, e.target.value.trim())} />
            <button className="btn icon" aria-label="Monter le jour" disabled={i === 0} onClick={() => moveDay(day.id, -1)}>↑</button>
            <button className="btn icon" aria-label="Descendre le jour" disabled={i === days.length - 1} onClick={() => moveDay(day.id, 1)}>↓</button>
          </div>
          <ul className="list" style={{ marginTop: 8 }}>
            {(exercisesByDay.get(day.id) ?? []).map((item, j, arr) => (
              <li key={item.id} className="row" style={{ minHeight: 44 }}>
                <span style={{ flex: 1 }}>{names.get(item.exercise_id) ?? '…'}</span>
                <button className="btn ghost icon" aria-label="Monter" disabled={j === 0} onClick={() => moveDayExercise(item.id, -1)}>↑</button>
                <button className="btn ghost icon" aria-label="Descendre" disabled={j === arr.length - 1} onClick={() => moveDayExercise(item.id, 1)}>↓</button>
                <button className="btn ghost icon" aria-label="Retirer" onClick={() => removeDayExercise(item.id)}>✕</button>
              </li>
            ))}
          </ul>
          <div className="row between" style={{ marginTop: 8 }}>
            <button className="btn" onClick={() => setPickingFor(day.id)}>＋ Exercice</button>
            <button className="btn ghost small" style={{ color: 'var(--danger)' }}
              onClick={() => confirm(`Supprimer « ${day.name} » ?`) && deleteDay(day.id)}>Supprimer le jour</button>
          </div>
        </div>
      ))}
      <button className="btn block" onClick={() => addDay(program.id, `Jour ${days.length + 1}`)}>＋ Ajouter un jour</button>
      <button className="btn danger block" style={{ marginTop: 24 }} onClick={remove}>Supprimer le programme</button>

      {pickingFor && (
        <Sheet title="Ajouter un exercice" onClose={() => setPickingFor(null)}>
          <ExercisePicker exclude={(exercisesByDay.get(pickingFor) ?? []).map((e) => e.exercise_id)}
            onPick={async (e) => { await addDayExercise(userId, pickingFor, e.id); setPickingFor(null) }} />
        </Sheet>
      )}
      {sharing && <ShareDialog programId={program.id} onClose={() => setSharing(false)} />}
    </section>
  )
}
