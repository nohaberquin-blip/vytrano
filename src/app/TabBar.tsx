import { NavLink } from 'react-router-dom'

const tabs = [
  { to: '/', label: 'Séance', icon: '▶' },
  { to: '/calendrier', label: 'Calendrier', icon: '▦' },
  { to: '/programmes', label: 'Programmes', icon: '☰' },
  { to: '/exercices', label: 'Exercices', icon: '◆' },
  { to: '/amis', label: 'Amis', icon: '●' },
]

export function TabBar({ badges = {} }: { badges?: Record<string, number> }) {
  return (
    <nav className="tabbar">
      {tabs.map((t) => (
        <NavLink key={t.to} to={t.to} end={t.to === "/"} className={({ isActive }) => (isActive ? "tab active" : "tab")}>
          <span className="tab-icon" aria-hidden>{t.icon}</span>
          <span className="tab-label">{t.label}</span>
          {badges[t.to] ? <span className="tab-badge" aria-hidden>{badges[t.to]}</span> : null}
        </NavLink>
      ))}
    </nav>
  )
}
