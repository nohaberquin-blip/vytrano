# Calendrier d'entraînement (étape 1) — Design

Date : 2026-10-24

## 1. Objectif

Un onglet **Calendrier** qui montre l'organisation de l'entraînement : séances prévues,
réalisées, manquées, reportées, jours de repos et objectif de séances par semaine.

Étapes suivantes, hors périmètre : bilan de fin de semaine (étape 2), rappels par
notification (étape 3).

## 2. Décisions validées

- Planification **automatique + manuelle** : l'utilisateur choisit ses jours d'entraînement
  (jours de la semaine) ; l'app y place les jours du programme actif dans l'ordre ; il peut
  déplacer une séance, en ajouter une, ou passer un jour en repos.
- Séance ratée : elle **glisse** au prochain jour d'entraînement (le programme suit en décalé).
- Objectif hebdomadaire : un **nombre de séances**, par défaut le nombre de jours
  d'entraînement, modifiable pour une semaine précise.
- Vues **mois et semaine**, avec bascule.
- Le planning futur n'est **pas stocké** : il est calculé à l'affichage.

## 3. Données (Postgres, migration 006 ; Dexie version 3)

Dates : chaînes locales `YYYY-MM-DD`. Semaine du lundi au dimanche. Jours de la semaine
codés 1 (lundi) … 7 (dimanche).

| Table | Colonnes |
|---|---|
| `training_schedules` | `user_id uuid pk` (= id local), `weekdays smallint[] not null` (valeurs 1–7, sans doublon), `since date not null`, `updated_at` |
| `schedule_overrides` | `id uuid pk`, `user_id`, `date date not null`, `kind text not null check (kind in ('train','rest'))`, `moved_to date null`, `updated_at` ; unique `(user_id, date)` |
| `weekly_goals` | `id uuid pk`, `user_id`, `week_start date not null` (un lundi), `sessions smallint not null check (sessions between 0 and 14)`, `updated_at` ; unique `(user_id, week_start)` |

- `since` : date d'activation du calendrier (mise à aujourd'hui quand on valide les jours
  pour la première fois, inchangée ensuite). Aucun jour avant `since` n'est « manqué ».
- Une exception par date au plus. Un report = l'exception `rest` sur la date d'origine avec
  `moved_to`, plus l'exception `train` sur la date d'arrivée.
- RLS : chaque utilisateur lit et écrit uniquement ses lignes (`user_id = auth.uid()`).
  Pas de partage avec les amis.
- Synchronisation : mêmes mécanismes que les autres tables (`repo.put` / `repo.remove`,
  outbox, `pull`).

## 4. Calcul des jours (`src/domain/calendar.ts`, fonctions pures)

Entrées : `schedule`, `overrides`, `goals`, séances terminées (`Workout` avec
`finished_at`, date locale de `started_at`), jours du programme actif (triés), dernier jour
de programme fait, aujourd'hui.

**Jour prévu** (`isPlanned(date)`) : exception `train` → oui ; exception `rest` → non ;
sinon le jour de la semaine est dans `weekdays`.

**État d'un jour** :

| Cas | État |
|---|---|
| au moins une séance terminée ce jour | `done` (même si le jour n'était pas prévu) |
| exception `rest` avec `moved_to` | `moved` (affiche la date d'arrivée) |
| passé, prévu, `date ≥ since`, sans séance | `missed` |
| aujourd'hui ou futur, prévu | `planned` |
| sinon | `rest` |

**Séance attribuée aux jours `planned`** : en partant d'aujourd'hui (ou de demain si
aujourd'hui est `done`), on parcourt les dates prévues dans l'ordre et on leur attribue
`nextDay` du programme, à la suite du dernier jour fait, en bouclant. Une séance ratée
glisse donc d'elle-même. Sans programme actif ou sans jour : `planned` sans séance
(« Séance libre »).

**Objectif de la semaine** : `goal = weekly_goals.sessions` s'il existe, sinon
`weekdays.length`. Progression = nombre de **dates** de la semaine à l'état `done`.
Atteint quand progression ≥ goal (et goal > 0).

## 5. Actions

- **Régler les jours** : crée ou met à jour `training_schedules` (garde `since`).
- **Déplacer** une séance prévue de D vers D2 (D2 ≥ aujourd'hui, D2 ≠ D, D2 non `done`) :
  exception `rest` sur D avec `moved_to = D2`, exception `train` sur D2. Si D2 avait une
  exception, elle est remplacée.
- **Annuler le report** : supprime les deux exceptions.
- **Passer en repos** : exception `rest` sans `moved_to` ; si le jour n'est prévu que par une
  exception `train`, on supprime simplement celle-ci.
- **Ajouter une séance** sur un jour de repos (aujourd'hui ou futur) : exception `train` ;
  si le jour avait une exception `rest`, on la supprime.
- **Changer l'objectif** d'une semaine : crée ou met à jour `weekly_goals` ; revenir à la
  valeur par défaut supprime la ligne.

## 6. Écrans

- **Onglet « Calendrier »**, 2ᵉ position : Séance · Calendrier · Programmes · Mes exercices · Amis.
- **Première ouverture** (pas de `training_schedules`) : « Quels jours tu t'entraînes ? »,
  7 cases L M M J V S D, bouton « Valider » (au moins un jour). Le bouton ⚙︎ de l'en-tête
  rouvre ce réglage.
- **En-tête** : titre (mois ou semaine), ‹ ›, « Aujourd'hui », bascule « Mois / Semaine »
  (choix mémorisé dans le navigateur).
- **Vue mois** : grille lundi→dimanche, une pastille par jour (vert `done`, bleu `planned`,
  gris `rest`, rouge `missed`, orange `moved`), aujourd'hui entouré, progression `3/4` en fin
  de ligne (verte si atteinte). Toucher un jour ouvre le détail.
- **Vue semaine** : 7 lignes (date, état, nom de la séance, exercices) ; en haut
  « Objectif : 3/4 séances », touchable pour changer l'objectif (− / +, « Par défaut »).
- **Détail d'un jour** (panneau du bas) :
  - `planned` : nom et exercices ; « Commencer » (aujourd'hui seulement, va à l'écran
    Séance), « Déplacer » (choix d'une date), « Passer en repos » ;
  - `rest` (aujourd'hui ou futur) : « Ajouter une séance ce jour » ;
  - `done` : résumé de la ou des séances (comme le détail du fil des amis) ;
  - `missed` : « Séance manquée — elle a glissé au prochain jour d'entraînement » ;
  - `moved` : « Séance déplacée au jeudi 30 » et « Annuler le report ».
- **Écran Séance** : si aujourd'hui est `rest`, texte « Jour de repos aujourd'hui » au-dessus
  du bouton ; on peut toujours démarrer.

## 7. Erreurs et cas limites

- Pas de programme actif : les jours prévus affichent « Séance libre ».
- Changement de programme actif ou de ses jours : le calendrier futur suit immédiatement.
- Plusieurs séances le même jour : un seul `done`, compté une fois pour l'objectif.
- Changer les jours d'entraînement ne rend pas « manqués » des jours passés qui ne l'étaient
  pas : le passé utilise les jours actuels mais seulement à partir de `since` ; on accepte
  cette approximation (pas d'historique des réglages).
- Une séance en cours n'est pas `done` tant qu'elle n'est pas terminée.
- Fuseau : tout est en date locale de l'appareil.

## 8. Tests

- Unitaires (`calendar.ts`) : chaque état, `since`, glissement d'une séance ratée, report,
  annulation, ajout, repos forcé, plusieurs séances un jour, semaine à cheval sur deux mois,
  objectif par défaut / modifié / atteint, sans programme.
- Données : actions du §5 (exceptions créées / supprimées), synchronisation des 3 tables.
- Composants : réglage des jours, vue mois (pastilles, progression), vue semaine, détail
  d'un jour (boutons selon l'état), bascule.
- SQL : `rls_check.sql` étendu (isolation des 3 tables, contraintes).
- Navigateur à 375 px : réglage, mois, semaine, déplacer puis annuler, séance terminée qui
  passe en vert.
