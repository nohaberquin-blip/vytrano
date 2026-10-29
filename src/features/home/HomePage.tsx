import { useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { saveHome } from '../../data/profile'
import {
  APPS, DEFAULT_LAYOUT, appColor, appSize, moveApp, readLayout, setAppColor, setAppHidden, setAppSize,
  type AppId, type HomeLayout,
} from '../../domain/home'
import { useAuth, useUserId } from '../auth/AuthProvider'
import { AppSheet, HiddenList } from './EditHome'
import { TILE_INFO } from './Tiles'
import { useIconDrag } from './useIconDrag'

const BADGE_OF: Partial<Record<AppId, string>> = { friends: '/amis' }

/** Accueil en bento : tuiles de tailles différentes sur 2 colonnes, avec les infos du moment. */
export function HomePage({ badges = {} }: { badges?: Record<string, number> }) {
  const userId = useUserId()
  const { profile, patchProfile } = useAuth()
  const saved = readLayout(profile?.home)
  const [draft, setDraftState] = useState<HomeLayout | null>(null)
  // Copie lisible hors rendu : le dépôt enregistre le brouillon sans effet de bord dans un updater React.
  const draftRef = useRef<HomeLayout | null>(null)
  const setDraft = (d: HomeLayout | null) => { draftRef.current = d; setDraftState(d) }
  const layout = draft ?? saved
  const [editing, setEditing] = useState(false)
  const [sheet, setSheet] = useState<AppId | null>(null)
  const [error, setError] = useState(false)
  // Les enregistrements partent les uns après les autres : le dernier choix gagne toujours.
  const queue = useRef(Promise.resolve())

  function update(next: HomeLayout) {
    setDraft(null)
    patchProfile({ home: next })
    queue.current = queue.current.then(async () => {
      const { error } = await saveHome(userId, next)
      setError(!!error)
    })
  }

  const drag = useIconDrag({
    editing,
    onLongPress: () => setEditing(true),
    onOver: (id, target) => setDraft(moveApp(draftRef.current ?? saved, id, target)),
    onDrop: () => { const d = draftRef.current; if (d) update(d) },
  })

  const apps = layout.apps.filter((id) => !layout.hiddenApps.includes(id))

  function onTileClick(id: AppId, e: MouseEvent) {
    if (drag.consumeClick()) { e.preventDefault(); return }
    if (editing) { e.preventDefault(); setSheet(id) }
  }

  return (
    <section className={editing ? 'page home editing' : 'page home'}>
      <h1 className="sr-only">Accueil</h1>
      {editing && (
        <div className="row between home-editbar">
          <button className="btn ghost" onClick={() => { if (window.confirm('Rétablir l’accueil par défaut ?')) update(DEFAULT_LAYOUT) }}>Réinitialiser</button>
          <button className="btn primary" onClick={() => { setEditing(false); setSheet(null) }}>Terminé</button>
        </div>
      )}
      {error && <p role="alert" className="error">Accueil non enregistré, réessaie plus tard.</p>}

      <ul className="bento" aria-label="Applications">
        {apps.map((id) => {
          const a = APPS.find((x) => x.id === id)!
          const badge = BADGE_OF[id] ? badges[BADGE_OF[id]!] ?? 0 : 0
          const Info = TILE_INFO[id]
          const classes = ['tile', `size-${appSize(layout, id)}`, `c-${appColor(layout, id)}`, drag.dragging === id && 'dragging']
          return (
            <li key={id} data-app={id} className={classes.filter(Boolean).join(' ')}>
              <Link
                to={a.to} className="tile-link" draggable={false}
                onPointerDown={(e) => drag.onPointerDown(id, e)}
                onClick={(e) => onTileClick(id, e)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className="tile-head">
                  <span className="tile-icon" aria-hidden>{a.emoji}</span>
                  <span className="tile-label">{a.label}</span>
                </span>
                {Info && <div className="tile-info"><Info badge={badge} /></div>}
              </Link>
            </li>
          )
        })}
      </ul>

      {editing ? (
        <HiddenList layout={layout} onShow={(id) => update(setAppHidden(layout, id, false))} />
      ) : (
        <button className="btn ghost home-edit" onClick={() => setEditing(true)}>Modifier l’accueil</button>
      )}

      {sheet && (
        <AppSheet
          id={sheet} layout={layout} visible={apps}
          onMove={(target) => update(moveApp(layout, sheet, target))}
          onSize={(size) => update(setAppSize(layout, sheet, size))}
          onColor={(c) => update(setAppColor(layout, sheet, c))}
          onHide={() => { update(setAppHidden(layout, sheet, true)); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  )
}
