# Accueil façon iPhone — Design

Date : 2026-10-29

## 1. Objectif

Remplacer la barre d'onglets du bas par un accueil en grille d'icônes (nom sous chaque icône), avec des
widgets en haut, personnalisable (ordre par glisser-déposer, couleurs, éléments masqués) et synchronisé
sur le compte. Un bouton flottant garde l'accès à la séance en cours.

## 2. Décisions validées

- Nutrition : page qui reprend la carte « Mes besoins » (retirée du Profil) ; pas de suivi des repas.
- Personnalisation : mode « Modifier » (déplacer, masquer, couleur par icône), enregistrée dans `profiles.home`.
- Widgets : données déjà calculées par l'app ; objectifs du jour cochés automatiquement.
- Navigation : « ‹ Accueil » dans l'en-tête, bouton flottant seulement pendant une séance, badge Amis sur l'icône.

## 3. Écrans et adresses

| Adresse | Écran |
|---|---|
| `/` | Accueil (nouveau) |
| `/seance` | Séance (ancien `/`) |
| `/nutrition` | Nutrition (nouveau : `NeedsCard`) |
| autres | inchangées |

- Barre d'onglets (`TabBar`) supprimée, ainsi que la réserve d'espace `--tabbar-h` en bas du contenu.
- En-tête : sur `/`, « Vytrano » + indicateur de synchronisation ; ailleurs, lien « ‹ Accueil » (vers `/`)
  et le nom de la page (`Séance`, `Calendrier`, `Programmes`, `Exercices`, `Nutrition`, `Amis`, `Profil`,
  `Paramètres`, `Records`, `Mon historique`) + indicateur de synchronisation. ⚙️ et « Profil » quittent l'en-tête.
- `DaySheet` (« démarrer ce jour ») navigue vers `/seance` au lieu de `/`.
- Profil : « Mes besoins » retiré.

## 4. Accueil

- **Widgets** (une colonne, au-dessus de la grille), chacun est un lien :
  - `next` « Prochaine séance » → `/seance` : « Aujourd'hui · Push A », « Demain · … », « Jeudi · … »
    (prochain jour prévu, aujourd'hui compris s'il n'a pas encore de séance terminée ; nom du jour du
    programme actif selon la rotation). Sans programme : « Choisis un programme ». Sans calendrier :
    le jour suivant de la rotation, sans date (« Push A »).
  - `progress` « Progression » → `/profil` : « Niveau N · titre », barre d'XP vers le niveau suivant,
    « 🔥 N semaines » (série).
  - `calories` « Calories » → `/nutrition` : « 2 300 kcal · 140 g de protéines par jour » ;
    sans fiche complète : « Complète ta fiche ».
  - `goals` « Objectifs du jour » → `/calendrier` : liste ✅/⬜ :
    - « Séance du jour » (seulement si aujourd'hui est un jour prévu ; ✅ si une séance terminée aujourd'hui) ;
    - « Objectif de {mois} : N / M séances » (si objectif du mois ; ✅ si atteint) ;
    - le défi actif dont la date de fin est la plus proche : titre + « N / M » (s'il y en a un).
    Sans aucune ligne : « Rien de prévu aujourd'hui ».
- **Icônes** (grille de 4 colonnes) : carré arrondi coloré + emoji, nom dessous ; chacune est un lien.

| id | Nom | Emoji | Adresse | Couleur par défaut |
|---|---|---|---|---|
| `session` | Séances | 🏋️ | `/seance` | `orange` |
| `calendar` | Calendrier | 📅 | `/calendrier` | `red` |
| `programs` | Programmes | 📋 | `/programmes` | `blue` |
| `exercises` | Exercices | 💪 | `/exercices` | `purple` |
| `nutrition` | Nutrition | 🥗 | `/nutrition` | `green` |
| `friends` | Amis | 👥 | `/amis` | `teal` |
| `profile` | Profil | 👤 | `/profil` | `indigo` |
| `settings` | Paramètres | ⚙️ | `/parametres` | `gray` |

- Couleurs (8) : `red`, `orange`, `yellow`, `green`, `teal`, `blue`, `indigo`, `purple`, plus `gray`
  (Paramètres par défaut, aussi proposé) — palette fixe, lisible en clair et en sombre (emoji sur fond plein).
- Badge Amis : nombre de demandes reçues, pastille rouge en haut à droite de l'icône (`aria-label` « Amis, N demandes »).

## 5. Mode « Modifier »

- Entrée : bouton « Modifier l'accueil » en bas, ou appui long (500 ms) sur une icône.
- Icônes qui tremblent (animation coupée si `prefers-reduced-motion`) ; glisser-déposer au doigt et à
  la souris (Pointer Events, sans bibliothèque) ; déplacement au clavier par boutons « ← » / « → » sur
  l'icône active (accessible). Les liens ne naviguent pas en mode Modifier.
- Toucher une icône → feuille : nom, 9 pastilles de couleur, « Masquer » (absent pour Paramètres).
- Widgets : boutons « ↑ » / « ↓ » et « Masquer ».
- Section « Masqués » en bas : chaque élément masqué avec « Afficher ».
- « Réinitialiser » (avec confirmation) → disposition par défaut ; « Terminé » sort du mode.

## 6. Données (`src/domain/home.ts`, migration 014)

```ts
type AppId = 'session' | 'calendar' | 'programs' | 'exercises' | 'nutrition' | 'friends' | 'profile' | 'settings'
type WidgetId = 'next' | 'progress' | 'calories' | 'goals'
type IconColor = 'red' | 'orange' | 'yellow' | 'green' | 'teal' | 'blue' | 'indigo' | 'purple' | 'gray'
interface HomeLayout { apps: AppId[]; hiddenApps: AppId[]; colors: Partial<Record<AppId, IconColor>>;
  widgets: WidgetId[]; hiddenWidgets: WidgetId[] }
```

- `apps` / `widgets` : ordre de tous les éléments (masqués compris) ; `hidden*` : sous-ensembles.
- `readLayout(raw: unknown): HomeLayout` : absent ou invalide → défaut ; ids inconnus et doublons
  ignorés ; ids manquants ajoutés à la fin ; `settings` jamais masqué ; couleurs invalides ignorées.
- Colonne `profiles.home jsonb null` (migration `014_accueil.sql`) ; `Profile.home?: unknown`.
- Enregistrement : appliqué tout de suite à l'écran et au cache du profil, puis `updateProfile`. En cas
  d'échec : « Accueil non enregistré, réessaie plus tard. » ; l'écran garde la disposition locale.

## 7. Bouton flottant

- `SessionFab` : visible quand une séance `in_progress` existe et que l'adresse n'est pas `/seance` ;
  lien « ▶ 32 min » (`aria-label` « Reprendre la séance, 32 min ») vers `/seance`, minutes rafraîchies
  chaque minute ; en bas à droite, au-dessus de la barre de repos quand elle est affichée.

## 8. Tests

- `home.ts` : défaut, valeur abîmée, ids inconnus / manquants / doublons, `settings` jamais masqué,
  déplacement, masquage / affichage, couleur, réinitialisation.
- Widgets (calculs purs) : prochaine séance (aujourd'hui non fait, aujourd'hui fait → suivant, sans
  calendrier, sans programme) ; objectifs du jour (jour prévu ou non, objectif du mois, défi le plus proche, aucun).
- Écrans : grille (8 liens, ordre, couleurs), badge Amis, mode Modifier (clavier, couleur, masquer,
  Paramètres non masquable, réinitialiser, enregistrement et échec), widgets, en-tête « ‹ Accueil »,
  pas de barre du bas, bouton flottant (affiché / caché sur `/seance`), Nutrition, Profil sans « Mes besoins »,
  `DaySheet` → `/seance`.
- SQL : `rls_check` inchangé (colonne de `profiles`, RLS existante).
- Navigateur à 375 px, clair et sombre.
