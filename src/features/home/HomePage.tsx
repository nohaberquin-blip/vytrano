import { Link } from 'react-router-dom'
import { APPS, appColor, readLayout, type AppId } from '../../domain/home'
import { useAuth } from '../auth/AuthProvider'
import { WIDGET_VIEWS } from './Widgets'

const BADGE_OF: Partial<Record<AppId, string>> = { friends: '/amis' }

export function HomePage({ badges = {} }: { badges?: Record<string, number> }) {
  const { profile } = useAuth()
  const layout = readLayout(profile?.home)
  const apps = layout.apps.filter((id) => !layout.hiddenApps.includes(id)).map((id) => APPS.find((a) => a.id === id)!)
  const widgets = layout.widgets.filter((id) => !layout.hiddenWidgets.includes(id))

  return (
    <section className="page home">
      <h1 className="sr-only">Accueil</h1>
      <div className="home-widgets">
        {widgets.map((id) => { const View = WIDGET_VIEWS[id]; return <View key={id} /> })}
      </div>
      <ul className="home-grid" aria-label="Applications">
        {apps.map((a) => {
          const badge = BADGE_OF[a.id] ? badges[BADGE_OF[a.id]!] ?? 0 : 0
          return (
            <li key={a.id}>
              <Link to={a.to} className="app" aria-label={badge ? `${a.label}, ${badge} demande${badge > 1 ? 's' : ''}` : a.label}>
                <span className={`app-icon c-${appColor(layout, a.id)}`} aria-hidden>
                  {a.emoji}
                  {badge > 0 && <span className="app-badge">{badge}</span>}
                </span>
                <span className="app-label">{a.label}</span>
              </Link>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
