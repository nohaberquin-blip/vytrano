import { Sheet } from '../../app/Sheet'
import { APPS, COLORS, WIDGETS, appColor, type AppId, type HomeLayout, type IconColor } from '../../domain/home'

export const COLOR_LABELS: Record<IconColor, string> = {
  red: 'Rouge', orange: 'Orange', yellow: 'Jaune', green: 'Vert', teal: 'Turquoise', blue: 'Bleu', indigo: 'Indigo', purple: 'Violet', gray: 'Gris',
}

const labelOf = (id: AppId) => APPS.find((a) => a.id === id)!.label

/** Feuille d'une icône en mode Modifier : place, couleur, masquer. */
export function AppSheet({ id, layout, visible, onMove, onColor, onHide, onClose }: {
  id: AppId; layout: HomeLayout; visible: AppId[]
  onMove(target: AppId): void; onColor(c: IconColor): void; onHide(): void; onClose(): void
}) {
  const label = labelOf(id)
  const i = visible.indexOf(id)
  const current = appColor(layout, id)
  return (
    <Sheet title={label} onClose={onClose}>
      <div className="grid-2 app-move">
        <button className="btn" disabled={i <= 0} aria-label={`Déplacer ${label} vers la gauche`} onClick={() => onMove(visible[i - 1])}>← Avant</button>
        <button className="btn" disabled={i >= visible.length - 1} aria-label={`Déplacer ${label} vers la droite`} onClick={() => onMove(visible[i + 1])}>Après →</button>
      </div>
      <p className="muted small">Couleur</p>
      <div className="color-choices">
        {COLORS.map((c) => (
          <button key={c} className={`color-dot c-${c}`} aria-label={COLOR_LABELS[c]} aria-pressed={c === current} onClick={() => onColor(c)} />
        ))}
      </div>
      {id !== 'settings' && <button className="btn danger" onClick={onHide}>Masquer</button>}
    </Sheet>
  )
}

/** Éléments masqués, à réafficher. */
export function HiddenList({ layout, onShowApp, onShowWidget }: {
  layout: HomeLayout; onShowApp(id: AppId): void; onShowWidget(id: HomeLayout['widgets'][number]): void
}) {
  const items = [
    ...layout.hiddenWidgets.map((id) => ({ key: id, label: WIDGETS.find((w) => w.id === id)!.label, show: () => onShowWidget(id) })),
    ...layout.hiddenApps.map((id) => ({ key: id, label: labelOf(id), show: () => onShowApp(id) })),
  ]
  if (items.length === 0) return null
  return (
    <section className="card home-hidden" aria-label="Masqués">
      <h2 className="card-title">Masqués</h2>
      {items.map((it) => (
        <div key={it.key} className="row between">
          <span>{it.label}</span>
          <button className="btn" aria-label={`Afficher ${it.label}`} onClick={it.show}>Afficher</button>
        </div>
      ))}
    </section>
  )
}
