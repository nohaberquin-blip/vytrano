import { useState } from 'react'
import { db } from '../../data/db'
import { repo } from '../../data/repo'
import { useLive } from '../../data/useLive'
import { BODY_PARTS, groupByBodyPart, toBodyPart, type BodyPart } from '../../domain/bodyParts'
import type { Exercise } from '../../domain/types'
import { useUserId } from '../auth/AuthProvider'

export const normalize = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim()

/** Catalogue commun (exercices de tout le monde), rangé par partie du corps. */
export function ExercisePicker({ onPick, exclude = [] }: { onPick(e: Exercise): void; exclude?: string[] }) {
  const userId = useUserId()
  const [q, setQ] = useState('')
  const [part, setPart] = useState<BodyPart | null>(null)
  const [creating, setCreating] = useState(false)
  const all = useLive(() => db.exercises.toArray(), []) ?? []
  const nq = normalize(q)
  const name = q.trim()

  const matches = all
    .filter((e) => !exclude.includes(e.id))
    .filter((e) => !part || toBodyPart(e.muscle_group) === part)
    .filter((e) => !nq || normalize(e.name).includes(nq))
  const exact = all.some((e) => normalize(e.name) === nq)

  async function create(bodyPart: BodyPart) {
    const ex = await repo.put<Exercise>('exercises', { id: crypto.randomUUID(), owner_id: userId, name, muscle_group: bodyPart })
    onPick(ex)
  }

  if (creating) {
    return (
      <div>
        <p>Dans quelle partie du corps ranger <strong>« {name} »</strong> ?</p>
        <div role="group" aria-label="Partie du corps" className="grid-2">
          {BODY_PARTS.map((p) => (
            <button key={p} className="btn" onClick={() => create(p)}>{p}</button>
          ))}
        </div>
        <button className="btn ghost block" style={{ marginTop: 12 }} onClick={() => setCreating(false)}>Retour</button>
      </div>
    )
  }

  return (
    <div>
      <input className="input" placeholder="Rechercher un exercice" aria-label="Rechercher un exercice" value={q}
        onChange={(e) => setQ(e.target.value)} autoFocus />
      <div className="chips" role="group" aria-label="Filtrer par partie du corps">
        <button className={part === null ? 'chip on' : 'chip'} aria-pressed={part === null} onClick={() => setPart(null)}>Tout</button>
        {BODY_PARTS.map((p) => (
          <button key={p} className={part === p ? 'chip on' : 'chip'} aria-pressed={part === p} onClick={() => setPart(p)}>{p}</button>
        ))}
      </div>
      {nq && !exact && name.length <= 60 && (
        <button className="list-item" onClick={() => setCreating(true)}>
          <strong>Créer « {name} »</strong><span>＋</span>
        </button>
      )}
      {groupByBodyPart(matches).map((g) => (
        <section key={g.part} aria-label={g.part}>
          <h3 className="group-title">{g.part}</h3>
          <ul className="list">
            {g.items.map((e) => (
              <li key={e.id}>
                <button className="list-item" onClick={() => onPick(e)}>{e.name}</button>
              </li>
            ))}
          </ul>
        </section>
      ))}
      {all.length === 0 && <p className="empty">Catalogue pas encore chargé. Connecte-toi à internet une première fois.</p>}
      {all.length > 0 && matches.length === 0 && !nq && <p className="empty">Aucun exercice dans cette partie pour l’instant.</p>}
    </div>
  )
}
