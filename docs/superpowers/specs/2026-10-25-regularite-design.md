# Régularité (série, niveau, badges) — Design

Date : 2026-10-25

Étape A de la motivation (B : records et progression, C : le mois, D : rappels — plus tard).

## 1. Objectif

Récompenser la régularité : une série de semaines réussies (avec jokers), un niveau d'expérience
qui monte avec les séances et les semaines réussies, et des badges. L'XP ne dépend jamais des charges
ni du volume. En option, les amis voient un résumé (niveau, titre, série, badges).

## 2. Décisions validées

- Semaine réussie = objectif de la semaine du Calendrier atteint ; joker gagné toutes les 4 semaines
  réussies (2 au plus).
- XP : 100 par séance terminée + 200 par semaine réussie, +10 % par semaine de série (×2 au plus).
- Partage : interrupteur séparé, désactivé par défaut.

## 3. Calcul (`src/domain/streak.ts`, pur, recalculé depuis l'historique)

Entrées : séances terminées (dates), `CalendarInput` (ou rien si le Calendrier n'est pas réglé),
aujourd'hui.

**Semaines** (lundi → dimanche), de la première semaine qui commence le jour ou après
`schedule.since` jusqu'à la semaine en cours :
- `weekProgress(input, monday)` donne `done`, `goal`, `reached` ;
- objectif 0 → **neutre** (ni succès ni échec, la série ne bouge pas) ;
- atteinte → **réussie** (y compris la semaine en cours dès que l'objectif est atteint) ;
- non atteinte et terminée → **ratée** ; la semaine en cours non atteinte → neutre.

**Série et jokers** (dans l'ordre des semaines) :
- réussie : série + 1 ; toutes les 4 semaines réussies (compteur total), joker + 1 (2 au plus) ;
- ratée : un joker est consommé s'il y en a (la série ne bouge pas), sinon série = 0.

**XP** :
- 100 par séance terminée (allégée comprise), à la date de la séance ;
- chaque semaine réussie : `round(200 × min(2, 1 + 0,1 × (série − 1)))`, la série étant celle juste
  après cette semaine (1re semaine : 200, 2e : 220, … 11e et plus : 400).

**Niveaux** : passer du niveau n au niveau n + 1 demande `1500 + 250 × (n − 1)` XP (niveau 2 à 1 500,
niveau 3 à 3 250…). Titres : 1 Débutant, 5 Régulier, 10 Confirmé, 15 Assidu, 20 Expert, 25 Élite,
30 Légende (le titre est celui du dernier palier atteint).

**Badges** (date = jour où la condition est remplie pour la première fois) :

| id | Libellé | Condition |
|---|---|---|
| `sessions-1/10/50/100/250/500` | « 1re séance », « 10 séances »… | nombre de séances terminées |
| `streak-4/12/26/52` | « 4 semaines de suite »… | série atteinte |
| `level-5/10/20/30` | « Niveau 5 »… | niveau atteint |
| `goal-1`, `goal-10` | « Premier objectif atteint », « 10 objectifs atteints » | semaines réussies |
| `comeback` | « Le retour » | séance après au moins 21 jours sans séance (et au moins une avant) |

`progress(input): { level, title, xp, xpInLevel, xpForNext, streak, jokers, badges: { id, date }[] }`.

Fin de séance : `progress` avant et après → XP gagnée, niveau atteint, nouveaux badges.

## 4. Écrans

- **Profil**, carte « Régularité » :
  - « Niveau 4 · Débutant », barre d'XP (`role="progressbar"`, « 820 / 2 250 XP ») ;
  - « 🔥 6 semaines de suite » et « 🃏 1 joker » (rien si 0) ;
  - grille de badges : débloqués (avec date au toucher), les autres grisés avec leur condition.
  - interrupteur « Montrer mon niveau et mes badges à mes amis » (désactivé par défaut).
- **Fin de séance** : le bandeau ajoute « +N XP », et « Niveau N atteint ! » / « Nouveau badge : … ».
- **Séance** : « 🔥 N semaines » sous le nom du programme si la série vaut au moins 1.
- **Amis** : sous le pseudo d'un ami qui partage : « Niv. 4 · Débutant · 🔥 6 » et ses badges en
  petit (nombre + 3 derniers).

## 5. Partage (migration 012)

| Élément | Définition |
|---|---|
| table `progress_cards` | `user_id uuid pk references auth.users on delete cascade`, `level smallint`, `title text`, `streak smallint`, `badges text[]`, `updated_at` |
| lecture | soi-même, ou un ami accepté (fonction `can_see_progress(owner)` en security definer, comme `can_see_workouts`) |
| écriture | soi-même seulement |

- Activé : l'app écrit la carte à l'activation puis après chaque séance terminée (et à l'ouverture du
  Profil si elle a changé). Désactivé : la carte est supprimée du serveur.
- L'interrupteur est mémorisé dans `profiles.share_progress boolean default false` (synchronisé avec
  le compte, pas seulement l'appareil).
- La carte n'est pas dans la synchronisation hors ligne : écriture directe, réessayée à la prochaine
  séance si elle échoue.

## 6. Tests

- Série : réussies, ratée avec et sans joker, jokers plafonnés à 2, semaine neutre (objectif 0),
  semaine en cours non atteinte neutre / atteinte comptée, semaines avant `since` ignorées.
- XP : séances, bonus avec série (200, 220, plafond 400) ; niveaux (1 499 → 1, 1 500 → 2, 3 250 → 3) ;
  titres.
- Badges : chaque famille, dates, « Le retour ».
- Écrans : carte du Profil, bandeau de fin (+XP, niveau, badge), série sur Séance, interrupteur
  (carte écrite puis supprimée), résumé d'un ami.
- SQL : `rls_check` (un ami lit la carte, un non-ami non, personne n'écrit celle d'un autre).
- Navigateur à 375 px.
