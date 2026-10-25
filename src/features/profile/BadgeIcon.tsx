import type { BadgeIcon as Icon, BadgeTier } from '../../domain/streak'

/** Pictogramme de musculation au centre du disque. */
function Glyph({ icon }: { icon: Icon }) {
  switch (icon) {
    case 'dumbbell':
      return (
        <g data-icon="dumbbell">
          <rect x="-10" y="-1.6" width="20" height="3.2" rx="1" />
          <rect x="-14" y="-7" width="4.5" height="14" rx="1.2" />
          <rect x="9.5" y="-7" width="4.5" height="14" rx="1.2" />
          <rect x="-17" y="-4.5" width="3" height="9" rx="1" />
          <rect x="14" y="-4.5" width="3" height="9" rx="1" />
        </g>
      )
    case 'flame':
      return <path data-icon="flame" d="M0,-13 C7,-5 9,2 5,9 C3,12.5 -3,12.5 -5,9 C-8,3 -4,-1 -2,-4 C-1,0 1,1 2,-1 C3,-5 1,-9 0,-13 Z" />
    case 'chevrons':
      return (
        <g data-icon="chevrons" fill="none" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-9,-1 L0,-9 L9,-1" />
          <path d="M-9,7 L0,-1 L9,7" />
          <path d="M-9,14 L0,6 L9,14" opacity="0.55" />
        </g>
      )
    case 'target':
      return (
        <g data-icon="target" fill="none" strokeWidth="2.4">
          <circle r="11" />
          <circle r="6" />
          <circle r="1.8" className="badge-glyph-fill" />
        </g>
      )
    case 'comeback':
      return (
        <g data-icon="comeback" fill="none" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round">
          <path d="M-9,8 A10,10 0 1,1 8,6" />
          <path d="M3,1 L8,6.5 L13,1" />
        </g>
      )
  }
}

/** Badge en disque de fonte : bord couleur du palier (bronze, argent, or, platine), grisé tant qu'il n'est pas obtenu. */
export function BadgeIcon({ icon, tier, locked = false, size = 44 }: { icon: Icon; tier: BadgeTier; locked?: boolean; size?: number }) {
  return (
    <svg className={`badge-icon tier-${tier}${locked ? ' locked' : ''}`} viewBox="-26 -26 52 52" width={size} height={size} aria-hidden="true">
      <circle r="24" className="badge-plate" />
      <circle r="21.5" className="badge-rim" fill="none" strokeWidth="4" />
      <circle r="17" className="badge-groove" fill="none" strokeWidth="1" />
      <g className="badge-glyph">
        <Glyph icon={icon} />
      </g>
    </svg>
  )
}
