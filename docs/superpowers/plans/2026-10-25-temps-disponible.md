# Temps disponible Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Option « Temps limité » qui raccourcit la séance par étapes en gardant les exercices prioritaires, sans toucher aux charges, aux reps ni aux repos.

**Architecture :**
- Calcul pur `estimateSeconds` / `fitToTime` dans `src/domain/fitTime.ts`.
- `planWorkout` dans `src/data/workouts.ts` (construit les séries sans rien écrire), réutilisé par l'aperçu et par `startWorkout(userId, day, minutes?)`.
- Étoile dans ProgramEditor ; choix et aperçu dans SessionPage.

**Tech Stack:** React 18, TypeScript, Dexie, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-temps-disponible-design.md`

## Global Constraints

- Les étapes et valeurs sont exactement celles des §3 et §4 de la spec.
- Les séries gardées sont identiques aux séries prévues (mêmes charges, reps et types) ; seules les positions changent.
- Libellés : « ⏱ Temps limité ? », « Annuler », « Prioritaire », « Ta séance tient en ~N min », « Séance adaptée : ~N min au lieu de ~M », « retiré », « Au plus court : ~N min », « Séance adaptée à N min ».
- Le script 010 doit être exécuté avant la publication.

## Review Focus

- Le premier exercice garde tous ses échauffements, et aucun exercice n'est jamais vidé sans être compté « retiré ».
- Une séance vide (jour sans exercice) ne plante ni l'estimation ni l'aperçu.
- Le double appui sur « Commencer » reste protégé : `startWorkout` garde son verrou.
- L'aperçu ne crée pas de séance.
- Un exercice présent deux fois dans le même jour est traité par ligne de jour, pas par `exercise_id` seul.

---

### Task 1: Estimation et réduction

**Files :** Create `src/domain/fitTime.ts`, `src/domain/fitTime.test.ts`

```ts
export interface FitExercise { key: string; exerciseId: string; priority: boolean; sets: WorkoutSet[] }   // ordre du jour
export function estimateSeconds(exercises: FitExercise[], fiches: Map<string, Pick<UserExercise,'rest_seconds'|'target_reps'|'current_weight'>>): number
export interface FitResult { exercises: FitExercise[]; changes: { key: string; from: number; to: number }[];
  fullSeconds: number; seconds: number; minimum: boolean; changed: boolean }
export function fitToTime(exercises: FitExercise[], fiches: Map<...>, minutes: number): FitResult
export const TIME_CHOICES = [90, 60, 45, 30, 20] as const
```

- [ ] Tests :
  - **Estimation** : 1 exercice, 2 séries de 10 reps, fiche avec 8 reps, référence 0 → 60 + 40 + 120 + 40 = 260 s.
  - **Séance qui tient** : `changed` false.
  - **Étape 1** : le 2ᵉ exercice passe de 2 échauffements à 1 (le dernier) ; le 1er garde les siens.
  - **Étape 2** : réduction de la fin vers le début ; arrêt dès que ça tient.
  - **Étape 3** : retrait de la fin vers le début ; un prioritaire n'est jamais retiré ; au moins 1 exercice gardé.
  - **Étape 4** : prioritaires à 2 unités.
  - **Méthodes** : top-set gardé, back-offs retirés ; un drop retiré avec sa série.
  - **Limite inatteignable** : `minimum` true.
  - **Positions** renumérotées.
  - **Liste vide** : 0 s, pas de plantage.
- [ ] FAIL → implémenter → PASS → commit.

### Task 2: Données

**Files :**
- Create : `supabase/migrations/010_temps_disponible.sql` (colonnes + `import_program` recopiée de 005 avec `priority`)
- Modify : `rls_check.sql`, `setup_all.sql` (001→008, 010), `src/domain/types.ts` (`ProgramDayExercise.priority?`, `Workout.time_limit?`), `src/data/programs.ts` (`setDayExercisePriority(id, on)`), `src/data/workouts.ts` (`planWorkout`, `previewWorkout(userId, day, minutes)`, `startWorkout(userId, day, minutes?)`)
- Tests : `src/data/workouts.test.ts`, `src/data/programs.test.ts`

- [ ] Tests :
  - `startWorkout(u, day, 20)` sur une grosse séance → moins de séries, `time_limit` 20 ;
  - sans minutes → identique à avant ;
  - `previewWorkout` n'écrit aucune séance ;
  - `setDayExercisePriority` enregistre `priority`.
- [ ] FAIL → implémenter → PASS → commit.

### Task 3: Écrans

**Files :** `src/features/programs/ProgramEditor.tsx`, `src/features/session/SessionPage.tsx`, `src/features/session/TimeLimit.tsx` (+ test), `styles.css`

- [ ] Tests :
  - étoile : bascule `aria-pressed` et enregistrement ;
  - séance : lien → choix 20 → aperçu « Séance adaptée … » avec « retiré » ;
  - « Annuler » → lien de nouveau ;
  - « Commencer » démarre avec 20 et affiche « Séance adaptée à 20 min ».
- [ ] FAIL → implémenter → PASS → build → commit.

### Task 4: Vérification

- [ ] Navigateur à 375 px : étoile, aperçu, démarrage.
- [ ] Docs : 010 dans `SETUP.md`.
