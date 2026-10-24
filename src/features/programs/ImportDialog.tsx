import { useState, type FormEvent } from 'react'
import { Sheet } from '../../app/Sheet'
import { pull } from '../../data/repo'
import { supabase } from '../../data/supabase'
import { useUserId } from '../auth/AuthProvider'

export function ImportDialog({ onClose, onImported }: { onClose(): void; onImported(programId: string): void }) {
  const userId = useUserId()
  const [code, setCode] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setError(null)
    const { data, error } = await supabase.rpc('import_program', { code: code.trim().toUpperCase() })
    if (error) {
      setBusy(false)
      setError(/introuvable/i.test(error.message) ? 'Aucun programme avec ce code.' : 'Import impossible. Vérifie ta connexion.')
      return
    }
    await pull(userId).catch(() => {})
    setBusy(false)
    onImported(data as string)
  }

  return (
    <Sheet title="Importer un programme" onClose={onClose}>
      <form onSubmit={submit}>
        <label className="field"><span>Code du programme</span>
          <input className="input num" autoCapitalize="characters" autoCorrect="off" maxLength={8} value={code}
            onChange={(e) => setCode(e.target.value)} placeholder="ex. K7QF2M9X" autoFocus />
        </label>
        {error && <p className="error" role="alert">{error}</p>}
        <button className="btn primary block big" disabled={busy || code.trim().length < 8}>Importer</button>
      </form>
    </Sheet>
  )
}
