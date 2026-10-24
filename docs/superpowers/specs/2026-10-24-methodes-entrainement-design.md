# Méthodes d'entraînement (étape 1) — Design

Date : 2026-10-24

## 1. Objectif

Permettre de suivre une progression fine en associant à chaque exercice une **méthode**
(top set + back-off, montée en charge, dropset, AMRAP…), décrite comme une liste de séries
prévues exprimées en pourcentage d'une **charge de référence**.

Étapes suivantes, hors périmètre : supersets / circuits (étape 2), programmes à pourcentages
5/3/1, 1RM, RPE/RIR (étape 3).

## 2. Décisions validées

- Approche : un **modèle de séries** stocké en bloc (JSON) sur la fiche, avec surcharge possible
  par exercice d'un jour de programme.
- Une **charge de référence commune** par exercice (fiche) ; un jour peut utiliser une autre
  méthode / d'autres pourcentages.
- Interrupteur **progression automatique** par fiche (activé par défaut).
- **Arrondi** des charges calculées réglable par fiche, 2,5 kg par défaut.
- Échauffement optionnel, combinable avec toutes les méthodes.

## 3. Modèle de séries

```ts
type SetKind =
  | 'warmup'    // ÉCHAUF.  — ne compte pas
  | 'work'      // TRAVAIL  — compte
  | 'top'       // TOP      — compte
  | 'backoff'   // BACK-OFF — compte
  | 'drop'      // DROP     — ne compte pas, rattachée à la série précédente
  | 'restpause' // REPRISE  — ne compte pas (rest-pause et myo-reps), rattachée
  | 'cluster'   // CLUSTER  — compte, rattachée (mini-série d'un cluster)
  | 'amrap'     // AMRAP    — compte

interface PlannedSet {
  kind: SetKind
  reps: number | null   // cible ; null = jusqu'à l'échec (aucune cible)
  repsMax?: number      // haut de fourchette (double progression, myo-reps)
  pct: number           // pourcentage de la charge de référence (100 = référence)
}

interface SetTemplate {
  method: MethodId      // méthode d'origine (pour l'affichage), 'custom' si modifiée librement
  sets: PlannedSet[]
}
```

Les séries « rattachées » (`drop`, `restpause`, `cluster` hors première) s'affichent en retrait
sous la série précédente.

## 4. Méthodes (modèles prêts à l'emploi)

Chaque méthode est une fonction pure `presets[method](params) → SetTemplate` avec des réglages
par défaut :

| `MethodId` | Libellé | Séries générées par défaut |
|---|---|---|
| `classic` | Classique | 4 × `work` 8 @100 |
| `top_backoff` | Top set + back-off | 1 × `top` 5 @100, 3 × `backoff` 8 @85 |
| `ramp` | Montée en charge | `work` 10@70, 8@80, 6@90, 4@100 |
| `pyramid_down` | Pyramide descendante | `work` 4@100, 6@90, 8@80, 10@70 |
| `pyramid_full` | Pyramide complète | `work` 10@70, 6@90, 4@100, 6@90, 10@70 |
| `dropset` | Dropset | 3 × `work` 8@100, puis `drop` échec @80, `drop` échec @60 |
| `rest_pause` | Rest-pause | `work` échec @100, 2 × `restpause` échec @100 |
| `myo_reps` | Myo-reps | `work` 12-15 @100, 4 × `restpause` 3-5 @100 |
| `cluster` | Cluster sets | 4 groupes de 3 × `cluster` 3 @100 |
| `amrap` | AMRAP | 3 × `work` 5 @100, 1 × `amrap` cible 5 @100 |
| `double_progression` | Double progression | 3 × `work` 8-12 @100 |

**Échauffement** : `withWarmup(template)` ajoute en tête `warmup` 8@50 et `warmup` 5@70.

Après génération, l'utilisateur peut ajouter, supprimer ou modifier chaque série
(type, reps, fourchette, %) ; la méthode passe alors à `custom` si la structure ne correspond plus
au modèle.

**Compatibilité** : une fiche sans modèle est lue comme `classic` avec ses `sets` × `target_reps`
@100 (aucune migration de données nécessaire côté client).

## 5. Données (Postgres, migration 005)

| Table | Nouvelles colonnes |
|---|---|
| `user_exercises` | `template jsonb null`, `auto_progression boolean not null default true`, `rounding numeric(5,2) not null default 2.5 check (rounding > 0)` |
| `program_day_exercises` | `template jsonb null` (null = méthode de la fiche) |
| `workout_sets` | `kind text not null default 'work'` (check dans la liste `SetKind`), `target_reps_max int null` ; `target_reps` devient nullable (série « jusqu'à l'échec ») |

Les séances passées deviennent des séries `work` (valeur par défaut). Les colonnes
`sets` / `target_reps` de `user_exercises` restent (compatibilité) ; elles ne servent plus que
pour une fiche sans modèle.

RLS : inchangée (mêmes tables, mêmes propriétaires).

## 6. Construction d'une séance

`buildWorkoutSets(workoutId, dayExercises, fiches, lastSetsByExercise)` :

1. modèle = `dayExercise.template ?? fiche.template ?? classicFrom(fiche)` ;
2. pour chaque série prévue :
   - **mode automatique** : charge = `roundTo(fiche.current_weight × pct / 100, fiche.rounding)` ;
   - **mode manuel** : charge = charge réelle de la série de même rang (même position dans le
     modèle) à la dernière séance terminée de cet exercice ; à défaut, calcul automatique ;
   - reps pré-remplies = `reps` (ou le bas de fourchette) ; série « échec » ou `amrap` : vide
     (0, à saisir) ;
3. chaque `WorkoutSet` garde `kind`, `target_reps` (null si échec), `target_reps_max`.

Arrondi : au multiple de `rounding` le plus proche, à 2 décimales près
(`roundTo(99.875, 2.5) = 100`, `roundTo(31, 2) = 32`).

## 7. Progression (fin de séance)

Pour chaque exercice de la séance, si `fiche.auto_progression` :

- séries qui comptent : `work`, `top`, `backoff`, `cluster`, `amrap` ;
- réussie : `done` et `reps ≥ cible`, où cible = `target_reps_max` s'il existe
  (double progression), sinon `target_reps` ; une série qui compte sans cible (échec) est réussie
  si validée ;
- si toutes les séries qui comptent sont réussies (et qu'il y en a au moins une) :
  `current_weight += increment` ; sinon inchangé.

Mode manuel : la référence n'est jamais modifiée automatiquement.

La référence étant commune, chaque séance terminée (quel que soit le jour) applique la règle
avec ses propres séries.

## 8. Écrans

- **Fiche (« Mes exercices »)** : charge de référence, palier, arrondi, interrupteur
  « Progression automatique », choix de la méthode (liste), case « Échauffement », puis la liste
  des séries prévues, éditable (type, reps / fourchette / échec, %) avec aperçu de la charge
  calculée.
- **Programme** : pour chaque exercice d'un jour, un lien « Méthode : identique à la fiche » qui
  ouvre le même éditeur pour définir une méthode propre à ce jour (et revenir à celle de la fiche).
- **Séance** : en-tête = nom de la méthode + résumé ; une étiquette de type par série
  (ÉCHAUF., TRAVAIL, TOP, BACK-OFF, DROP, REPRISE, CLUSTER, AMRAP), séries rattachées en retrait ;
  champs pré-remplis comme en §6 ; « ＋ Série » ajoute une série du même type que la dernière.
- **Détail d'une séance** (historique, fil des amis) : affiche les étiquettes.

## 9. Erreurs et cas limites

- Modèle JSON invalide ou inconnu (donnée corrompue, version future) : lu comme `classic`
  depuis la fiche ; jamais de plantage.
- Modèle vide : refusé par l'éditeur (au moins une série qui compte).
- Pourcentage hors 1–200 ou reps hors 1–100 : refusé par l'éditeur.
- Charge de référence à 0 : toutes les charges calculées valent 0 (comme aujourd'hui).

## 10. Tests

- Unitaires : chaque `preset`, `withWarmup`, `roundTo`, lecture d'un modèle invalide,
  `buildWorkoutSets` (auto / manuel / surcharge du jour), règle de progression (chaque type,
  double progression, AMRAP, échec, mode manuel).
- Données : reprise d'une séance avec séries de types variés ; synchronisation des nouvelles
  colonnes.
- Composants : éditeur de méthode (choix, échauffement, édition d'une série), carte de séance
  (étiquettes, retrait, AMRAP vide).
- SQL : `rls_check.sql` étendu (nouvelles colonnes, contrainte `kind`).
- Navigateur : parcours complet top set + back-off sur deux jours.
