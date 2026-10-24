import { useEffect, useState } from 'react'
import { Sheet } from '../../app/Sheet'
import { db } from '../../data/db'
import { supabase } from '../../data/supabase'
import { sync } from '../auth/AuthProvider'

export function ShareDialog({ programId, onClose }: { programId: string; onClose(): void }) {
  const [code, setCode] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)

  useEffect(() => {
    let cancelled = false
    ;(async () => {
      // Le programme doit exister sur le serveur avant d'être partagé.
      await sync.flush()
      if (await db.outbox.where('dead').equals(0).count()) {
        if (!cancelled) setError('Pas de connexion : le programme n’est pas encore synchronisé.')
        return
      }
      const { data, error } = await supabase.rpc('share_program', { program_id: programId })
      if (cancelled) return
      if (error) { setError('Impossible de générer le code. Vérifie ta connexion.'); return }
      // Copie locale du code (colonne gérée par le serveur, jamais renvoyée).
      await db.programs.update(programId, { share_code: data as string })
      setCode(data as string)
    })()
    return () => { cancelled = true }
  }, [programId])

  async function copy() {
    if (!code) return
    try {
      await navigator.clipboard.writeText(code)
      setCopied(true)
    } catch { /* presse-papiers refusé : le code reste affiché */ }
  }

  return (
    <Sheet title="Partager le programme" onClose={onClose}>
      {!code && !error && <p className="muted">Génération du code…</p>}
      {error && <p className="error">{error}</p>}
      {code && (
        <div className="stack">
          <p className="muted">Donne ce code à un ami : il pourra importer sa propre copie du programme.</p>
          <div className="card num" style={{ fontSize: 32, fontWeight: 800, letterSpacing: '0.15em', textAlign: 'center' }}>{code}</div>
          <button className="btn primary block" onClick={copy}>{copied ? 'Copié ✓' : 'Copier le code'}</button>
        </div>
      )}
    </Sheet>
  )
}
