import { useRef, useState, type MouseEvent } from 'react'
import { Link } from 'react-router-dom'
import { saveHome } from '../../data/profile'
import {
  APPS, DEFAULT_LAYOUT, WIDGETS, appColor, moveApp, moveWidget, readLayout, setAppColor, setAppHidden, setWidgetHidden,
  type AppId, type HomeLayout,
} from '../../domain/home'
import { useAuth, useUserId } from '../auth/AuthProvider'
import { AppSheet, HiddenList } from './EditHome'
import { useIconDrag } from './useIconDrag'
import { WIDGET_VIEWS } from './Widgets'

const BADGE_OF: Partial<Record<AppId, string>> = { friends: '/amis' }

export function HomePage({ badges = {} }: { badges?: Record<string, number> }) {
  const userId = useUserId()
  const { profile, patchProfile } = useAuth()
  const saved = readLayout(profile?.home)
  const [draft, setDraft] = useState<HomeLayout | null>(null)
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
    onOver: (id, target) => setDraft((d) => moveApp(d ?? saved, id, target)),
    onDrop: () => setDraft((d) => { if (d) update(d); return null }),
  })

  const apps = layout.apps.filter((id) => !layout.hiddenApps.includes(id))
  const widgets = layout.widgets.filter((id) => !layout.hiddenWidgets.includes(id))

  function onAppClick(id: AppId, e: MouseEvent) {
    if (drag.consumeClick()) { e.preventDefault(); return }
    if (editing) { e.preventDefault(); setSheet(id) }
  }
  // En mode Modifier, les widgets ne s'ouvrent pas.
  const blockLinks = (e: MouseEvent) => { if (editing && (e.target as Element).closest('a')) e.preventDefault() }

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

      <div className="home-widgets" onClickCapture={blockLinks}>
        {widgets.map((id, i) => {
          const View = WIDGET_VIEWS[id]
          const label = WIDGETS.find((w) => w.id === id)!.label
          return (
            <div key={id} className="widget-slot">
              <View />
              {editing && (
                <div className="widget-tools">
                  <button className="btn" aria-label={`Monter ${label}`} disabled={i === 0} onClick={() => update(moveWidget(layout, id, widgets[i - 1]))}>↑</button>
                  <button className="btn" aria-label={`Descendre ${label}`} disabled={i === widgets.length - 1} onClick={() => update(moveWidget(layout, id, widgets[i + 1]))}>↓</button>
                  <button className="btn" aria-label={`Masquer ${label}`} onClick={() => update(setWidgetHidden(layout, id, true))}>Masquer</button>
                </div>
              )}
            </div>
          )
        })}
      </div>

      <ul className="home-grid" aria-label="Applications">
        {apps.map((id) => {
          const a = APPS.find((x) => x.id === id)!
          const badge = BADGE_OF[id] ? badges[BADGE_OF[id]!] ?? 0 : 0
          return (
            <li key={id} data-app={id} className={drag.dragging === id ? 'dragging' : undefined}>
              <Link
                to={a.to} className="app" draggable={false}
                aria-label={badge ? `${a.label}, ${badge} demande${badge > 1 ? 's' : ''}` : a.label}
                onPointerDown={(e) => drag.onPointerDown(id, e)}
                onClick={(e) => onAppClick(id, e)}
                onContextMenu={(e) => e.preventDefault()}
              >
                <span className={`app-icon c-${appColor(layout, id)}`} aria-hidden>
                  {a.emoji}
                  {badge > 0 && <span className="app-badge">{badge}</span>}
                </span>
                <span className="app-label">{a.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>

      {editing ? (
        <HiddenList
          layout={layout}
          onShowApp={(id) => update(setAppHidden(layout, id, false))}
          onShowWidget={(id) => update(setWidgetHidden(layout, id, false))}
        />
      ) : (
        <button className="btn ghost home-edit" onClick={() => setEditing(true)}>Modifier l’accueil</button>
      )}

      {sheet && (
        <AppSheet
          id={sheet} layout={layout} visible={apps}
          onMove={(target) => update(moveApp(layout, sheet, target))}
          onColor={(c) => update(setAppColor(layout, sheet, c))}
          onHide={() => { update(setAppHidden(layout, sheet, true)); setSheet(null) }}
          onClose={() => setSheet(null)}
        />
      )}
    </section>
  )
}
