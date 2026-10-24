# Mon cycle — Design

Date : 2026-10-25

## 1. Objectif

Pour les profils « Femme » seulement : noter ses règles dans le Calendrier et, les jours de règles
(notés ou prévus), pouvoir alléger sa séance quand on ne se sent pas bien, sans que cela fausse la
progression. Ce n'est pas un suivi de cycle : pas de symptômes, pas de statistiques.

## 2. Décisions validées

- Visible seulement si `body_profiles.sex = 'female'`. Sinon rien n'apparaît (ni dans le Calendrier,
  ni dans Séance).
- Saisie : « Début des règles » + durée (5 jours par défaut, 2 à 10), avec prévision des suivantes.
- « Je ne me sens pas bien » proposé seulement les jours de règles notés ou prévus.
- Allègement au choix : **−10 %**, **−20 %** ou **Moins de séries**.
- Une séance allégée est neutre pour la progression.

## 3. Règles et prévision (`src/domain/cycle.ts`)

- Une **période** : `start` (date) et `days` (2 à 10). Jours couverts : `start` … `start + days − 1`.
- **Cycle** : écart en jours entre deux débuts consécutifs. Seuls les écarts de 15 à 60 jours comptent
  (une saisie oubliée ne fausse pas la moyenne).
- **Prévision** :
  - longueur = moyenne arrondie des 3 derniers cycles valides ; 28 s'il n'y en a aucun ;
  - durée = celle de la dernière période notée ;
  - prochains débuts = dernier début + k × longueur (k = 1, 2, …), tant qu'ils tombent dans la plage
    affichée ; un début prévu déjà passé avant aujourd'hui n'est pas affiché (on attend la vraie saisie) ;
  - un jour noté n'est jamais aussi « prévu » ;
  - sans aucune période notée : aucune prévision.
- `periodState(date, periods, today): 'period' | 'predicted' | null`.

## 4. Allègement (`src/domain/lighten.ts`)

`lighten(sets, mode, roundingOf)` sur les séries prévues de la séance :
- **`'minus10'` / `'minus20'`** : chaque charge × 0,9 / × 0,8, arrondie avec `roundTo` au pas
  d'arrondi de l'exercice (comme les pourcentages des méthodes). Séries, types et répétitions inchangés.
- **`'fewer'`** : chaque exercice garde au plus 2 unités (même définition et même règle que
  « Temps disponible » §4 : séries rattachées avec leur série, top-sets retirés en dernier,
  échauffements gardés). Charges inchangées.
- Positions renumérotées. Combinable avec « Temps limité » : allègement d'abord, puis `fitToTime`.

## 5. Progression neutre

- À la fin d'une séance allégée (`workouts.lightened` non nul), les charges de référence des fiches ne
  changent pas, même si toutes les séries sont réussies.
- `lastSetsFor` ignore les séances allégées : la séance suivante (mode manuel compris) et
  « la dernière fois » repartent de la dernière séance normale.
- Les séances allégées restent dans l'historique, le calendrier et les objectifs de la semaine.

## 6. Données (migration 011)

| Élément | Définition |
|---|---|
| table `periods` | `id uuid pk`, `user_id uuid` (propriétaire, RLS comme les autres tables privées), `start date not null`, `days smallint not null check (days between 2 and 10)`, `updated_at`, unique `(user_id, start)` |
| `workouts.lightened` | `text null check (lightened in ('minus10','minus20','fewer'))` |

Côté client : table Dexie `periods` (version 5), synchronisée comme les autres ; id stable
`stableId('period', userId, start)`. `Workout.lightened?` optionnel.

## 7. Écrans

- **Calendrier** (profil « Femme ») :
  - jours notés : point rose ; jours prévus : rose pâle ; légende « Règles » / « Règles prévues » ;
  - fiche du jour : « Début des règles » (durée 5 par défaut, champ « Durée (jours) », 2 à 10) ;
    sur un jour d'une période notée : « Modifier la durée » et « Supprimer ces règles ».
- **Séance (avant de commencer)**, profil « Femme » et jour de règles noté ou prévu :
  - lien « 🌸 Je ne me sens pas bien » à côté de « ⏱ Temps limité ? » ;
  - choix « −10 % », « −20 % », « Moins de séries » (`aria-pressed`), un aperçu
    (« Charges −10 % : Squat 60 → 54 kg… » ou « Moins de séries : Squat 4 → 2 séries… ») et « Annuler » ;
  - « Commencer » et « Faire un autre jour » utilisent l'allègement choisi.
- **Séance en cours et historique** : mention « Séance allégée ».

## 8. Tests

- Prévision : moyenne de 3 cycles, 28 par défaut, écarts hors 15–60 ignorés, jour noté ≠ prévu,
  début prévu passé non affiché, aucune période → rien.
- Allègement : −10 % / −20 % arrondis au pas, « Moins de séries » (rattachées, top-set,
  échauffements), combiné avec le temps limité.
- Progression : séance allégée réussie → charge inchangée ; `lastSetsFor` saute la séance allégée.
- Écrans : rien pour un profil non « Femme » ; noter / modifier / supprimer des règles ; lien
  seulement un jour de règles ; démarrage allégé et mention.
- SQL : `rls_check.sql` (B ne voit pas les règles de A, durée 1 refusée, `lightened` invalide refusé).
- Navigateur à 375 px.
