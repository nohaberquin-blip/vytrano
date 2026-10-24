import { useState, type FormEvent } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Sheet } from '../../app/Sheet'
import { db } from '../../data/db'
import { addDay, createProgram } from '../../data/programs'
import { useLive } from '../../data/useLive'
import { useUserId } from '../auth/AuthProvider'
import { ImportDialog } from './ImportDialog'
import { ProgramEditor } from './ProgramEditor'

export function ProgramsPage() {
  const userId = useUserId()
  const [params, setParams] = useSearchParams()
  const [editing, setEditing] = useState<string | null>(null)
  const [name, setName] = useState('')
  const creating = params.get('nouveau') === '1'
  const importing = params.get('import') === '1'
  const closeDialogs = () => setParams({}, { replace: true })

  const programs = useLive(async () => {
    const list = await db.programs.where('owner_id').equals(userId).toArray()
    return Promise.all(list.map(async (p) => ({
      program: p,
      dayCount: await db.program_days.where('program_id').equals(p.id).count(),
    })))
  }, [userId])

  if (editing) return <ProgramEditor programId={editing} onBack={() => setEditing(null)} />

  async function create(e: FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    const p = await createProgram(userId, name.trim())
    await addDay(p.id, 'Jour 1')
    setName('')
    closeDialogs()
    setEditing(p.id)
  }

  const sorted = [...(programs ?? [])].sort((a, b) => Number(b.program.is_active) - Number(a.program.is_active) || a.program.name.localeCompare(b.program.name, 'fr'))

  return (
    <section className="page">
      <h1>Programmes</h1>
      <div className="grid-2" style={{ marginBottom: 16 }}>
        <button className="btn primary" onClick={() => setParams({ nouveau: '1' })}>＋ Nouveau</button>
        <button className="btn" onClick={() => setParams({ import: '1' })}>Importer un code</button>
      </div>
      {programs && programs.length === 0 && <p className="empty">Pas encore de programme. Crée le tien ou importe celui d’un ami.</p>}
      <ul className="list">
        {sorted.map(({ program, dayCount }) => (
          <li key={program.id}>
            <button className="list-item" onClick={() => setEditing(program.id)}>
              <span>
                <strong>{program.name}</strong> {program.is_active && <span className="pill">Actif</span>}<br />
                <span className="muted small">{dayCount} jour{dayCount > 1 ? 's' : ''}</span>
              </span>
              <span className="muted">›</span>
            </button>
          </li>
        ))}
      </ul>

      {creating && (
        <Sheet title="Nouveau programme" onClose={closeDialogs}>
          <form onSubmit={create}>
            <label className="field"><span>Nom</span>
              <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. PPL 4 jours" autoFocus maxLength={60} />
            </label>
            <button className="btn primary block big" disabled={!name.trim()}>Créer</button>
          </form>
        </Sheet>
      )}
      {importing && (
        <ImportDialog onClose={closeDialogs} onImported={(id) => { closeDialogs(); setEditing(id) }} />
      )}
    </section>
  )
}
