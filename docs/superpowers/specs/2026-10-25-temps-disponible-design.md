# Temps disponible — Design

Date : 2026-10-25

## 1. Objectif

En option, avant de commencer, l'utilisateur indique le temps dont il dispose : 90, 60, 45, 30 ou
20 minutes. L'app estime la durée de la séance prévue. Si elle dépasse, l'app la raccourcit en
gardant les exercices les plus importants, sans jamais toucher aux charges, aux répétitions ni aux
repos (pas de compensation par l'intensité). Sans choix, rien ne change.

## 2. Décisions validées

- Option facultative : lien « ⏱ Temps limité ? » sous « Commencer ». Le choix n'est pas retenu
  d'une séance à l'autre.
- Importance d'un exercice : l'ordre du jour, plus une étoile « prioritaire » par exercice d'un
  jour de programme.
- Réduction par étapes (§4). Le mode « Je n'ai que 20 minutes » est le choix « 20 min ».

## 3. Estimation de la durée (`src/domain/fitTime.ts`)

Pour la liste ordonnée des séries prévues :
- **Série** : max(30 s, reps visées × 4 s). Reps visées absentes (échec, AMRAP) : 10.
- **Repos après chaque série** : `restSeconds(série, suivante, fiche)` du minuteur, en supposant
  les reps visées faites. Aucun repos après la dernière série.
- **Installation** : 60 s par exercice.

Résultat en secondes ; affichage arrondi à la minute (« ~44 min »).

## 4. Réduction (`fitToTime`)

Vocabulaire :
- une **unité** est une série principale (ni échauffement, ni rattachée) suivie de ses séries
  rattachées (drop, reprise, cluster) ;
- réduire un exercice à 2 unités, c'est retirer des unités en partant de la fin, en retirant les
  top-sets en dernier.

On s'arrête dès que l'estimation tient dans la limite :
0. La séance complète tient → aucun changement.
1. **Échauffements** : un seul par exercice (le dernier, le plus proche de la charge de travail),
   sauf pour le premier exercice qui garde tous les siens.
2. **Exercices non prioritaires, de la fin vers le début** : 2 unités au plus, un exercice à la
   fois.
3. **Exercices non prioritaires, de la fin vers le début** : retirés, un à la fois. Il reste
   toujours au moins un exercice : si aucun n'est prioritaire, le premier n'est jamais retiré.
4. **Exercices prioritaires, de la fin vers le début** : 2 unités au plus.

Si l'estimation dépasse encore la limite : le résultat de l'étape 4 est gardé, avec `minimum: true`
(« Au plus court : ~26 min »).

Le résultat donne :
- les séries gardées, positions renumérotées ;
- l'estimation complète et l'estimation adaptée ;
- par exercice, le nombre de séries avant et après (0 = retiré).

## 5. Données (migration 010)

| Colonne | Définition |
|---|---|
| `program_day_exercises.priority` | `boolean not null default false` |
| `workouts.time_limit` | `smallint null check (time_limit between 10 and 180)` |

`import_program` copie aussi `priority`. Côté client, les deux champs sont optionnels (`false` et
`null` si absents).

## 6. Écrans

- **Programmes** : une étoile (☆ / ⭐) devant chaque exercice d'un jour, avec le libellé
  « Prioritaire » et `aria-pressed`.
- **Séance (avant de commencer)** :
  - sous « Commencer », le lien « ⏱ Temps limité ? » ;
  - il ouvre les choix 90 · 60 · 45 · 30 · 20 min, un champ « Ou ton temps » (10 à 180 min, rempli
    par les propositions), un aperçu et « Annuler » (retour à la séance complète, lien de nouveau affiché).
- **Aperçu** :
  - « Ta séance tient en ~52 min » si rien ne change ;
  - sinon « Séance adaptée : ~44 min au lieu de ~62 » et, par exercice : « inchangé »,
    « 4 → 2 séries » ou « retiré » (texte barré) ;
  - « Au plus court : ~26 min » si la limite n'est pas atteignable.
- **Démarrage** : « Commencer » et « Faire un autre jour » utilisent le temps choisi.
- **Séance en cours** : « Séance adaptée à 45 min » sous le titre si `time_limit` est défini.

## 7. Tests

- Estimation : exemple vérifié à la main.
- `fitToTime` :
  - séance qui tient (rien ne change) ;
  - chaque étape, dans l'ordre ;
  - ordre de fin vers début ;
  - prioritaire jamais retiré ;
  - au moins un exercice ;
  - top-set gardé, rattachées retirées avec leur série ;
  - `minimum` ;
  - positions renumérotées.
- Données :
  - séance démarrée avec un temps : séries réduites et `time_limit` enregistré ;
  - étoile enregistrée.
- Écrans :
  - étoile ;
  - lien, choix, aperçu, Annuler ;
  - mention pendant la séance.
- SQL : `rls_check.sql` (contrainte `time_limit`, import qui copie `priority`).
- Navigateur à 375 px.
