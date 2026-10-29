import { Sheet } from '../../app/Sheet'
import { APPS, COLORS, SIZES, appColor, appSize, type AppId, type HomeLayout, type IconColor, type TileSize } from '../../domain/home'

export const COLOR_LABELS: Record<IconColor, string> = {
  red: 'Rouge', orange: 'Orange', yellow: 'Jaune', green: 'Vert', teal: 'Turquoise', blue: 'Bleu', indigo: 'Indigo', purple: 'Violet', gray: 'Gris',
}

export const SIZE_LABELS: Record<TileSize, string> = { small: 'Petite', wide: 'Large', tall: 'Haute', large: 'Grande' }

const labelOf = (id: AppId) => APPS.find((a) => a.id === id)!.label

/** Feuille d'une tuile en mode Modifier : place, taille, couleur, masquer. */
export function AppSheet({ id, layout, visible, onMove, onSize, onColor, onHide, onClose }: {
  id: AppId; layout: HomeLayout; visible: AppId[]
  onMove(target: AppId): void; onSize(s: TileSize): void; onColor(c: IconColor): void; onHide(): void; onClose(): void
}) {
  const size = appSize(layout, id)
  const label = labelOf(id)
  const i = visible.indexOf(id)
  const current = appColor(layout, id)
  return (
    <Sheet title={label} onClose={onClose}>
      <div className="grid-2 app-move">
        <button className="btn" disabled={i <= 0} aria-label={`Déplacer ${label} vers la gauche`} onClick={() => onMove(visible[i - 1])}>← Avant</button>
        <button className="btn" disabled={i >= visible.length - 1} aria-label={`Déplacer ${label} vers la droite`} onClick={() => onMove(visible[i + 1])}>Après →</button>
      </div>
      <p className="muted small">Taille</p>
      <div className="size-choices">
        {SIZES.map((sz) => (
          <button key={sz} className="btn size-choice" aria-label={SIZE_LABELS[sz]} aria-pressed={sz === size} onClick={() => onSize(sz)}>
            <span className={`size-shape shape-${sz}`} aria-hidden />
            {SIZE_LABELS[sz]}
          </button>
        ))}
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

/** Tuiles masquées, à réafficher. */
export function HiddenList({ layout, onShow }: { layout: HomeLayout; onShow(id: AppId): void }) {
  if (layout.hiddenApps.length === 0) return null
  return (
    <section className="card home-hidden" aria-label="Masqués">
      <h2 className="card-title">Masqués</h2>
      {layout.hiddenApps.map((id) => (
        <div key={id} className="row between">
          <span>{labelOf(id)}</span>
          <button className="btn" aria-label={`Afficher ${labelOf(id)}`} onClick={() => onShow(id)}>Afficher</button>
        </div>
      ))}
    </section>
  )
}
