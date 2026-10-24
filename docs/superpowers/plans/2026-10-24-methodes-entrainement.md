# Méthodes d'entraînement (étape 1) — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Associer à chaque exercice une méthode (modèle de séries en % d'une charge de référence), l'utiliser pour construire les séances et calculer la progression, en mode automatique ou manuel.

**Architecture:** Logique pure dans `src/domain/methods.ts` (modèles, arrondi, lecture tolérante) ; `buildWorkoutSets` et `nextWeight` réécrits autour du type de série ; un éditeur de méthode réutilisé par la fiche et par l'exercice d'un jour ; migration SQL 005 avec colonnes à valeurs par défaut.

**Tech Stack:** React 18, TypeScript, Dexie 4, Supabase, Vitest + Testing Library (existants).

**Spec:** `docs/superpowers/specs/2026-10-24-methodes-entrainement-design.md`

## Global Constraints

- Interface en français ; étiquettes exactes : ÉCHAUF., TRAVAIL, TOP, BACK-OFF, DROP, REPRISE, CLUSTER, AMRAP.
- Charges stockées en kg ; arrondi par défaut 2,5 ; `rounding ≤ 0` ou absent traité comme 2,5.
- Valeurs de la spec §4 recopiées à l'identique dans les modèles par défaut.
- Toute écriture passe par `repo.put` (outbox) ; aucune nouvelle table.
- Un modèle illisible est lu comme `classic` depuis la fiche, sans erreur.
- Mise en ligne : **SQL 005 d'abord, publication ensuite** (le nouveau client écrit des colonnes que l'ancienne base ne connaît pas).

## Review Focus

1. Fiche locale ancienne sans `rounding` / `auto_progression` / `template` → valeurs par défaut (2,5 / true / classic). → test Task 1 (`readTemplate`) et Task 3.
2. Mode manuel quand la séance précédente avait moins de séries que le modèle → séries en trop calculées en automatique. → test Task 3.
3. Série « jusqu'à l'échec » validée avec 0 rep saisie → compte comme réussie si elle compte, jamais de NaN. → test Task 4.
4. Exercice présent deux jours avec méthodes différentes → chaque jour génère sa propre méthode, référence commune. → test Task 3.
5. `target_reps` null renvoyé par le serveur / colonnes absentes d'une série ancienne (`kind` manquant) → lu comme `work`. → test Task 2.

---

### Task 1: Modèles de séries et méthodes (domaine pur)

**Files:**
- Create: `src/domain/methods.ts`
- Test: `src/domain/methods.test.ts`

**Interfaces:**
- Produces: `SetKind`, `PlannedSet { kind; reps: number | null; repsMax?: number; pct: number }`, `MethodId` (`'classic' | 'top_backoff' | 'ramp' | 'pyramid_down' | 'pyramid_full' | 'dropset' | 'rest_pause' | 'myo_reps' | 'cluster' | 'amrap' | 'double_progression' | 'custom'`), `SetTemplate { method: MethodId; sets: PlannedSet[] }`.
- Produces: `METHOD_LABELS: Record<MethodId, string>` (libellés de la spec §4, `custom` = « Personnalisée »), `KIND_LABELS: Record<SetKind, string>` (étiquettes exactes), `COUNTING_KINDS: SetKind[]` = work, top, backoff, cluster, amrap, `ATTACHED_KINDS: SetKind[]` = drop, restpause, cluster.
- Produces: `presetTemplate(method: Exclude<MethodId,'custom'>): SetTemplate`, `withWarmup(t: SetTemplate): SetTemplate`, `hasWarmup(t): boolean`, `withoutWarmup(t): SetTemplate`.
- Produces: `classicFrom(f: { sets: number; target_reps: number }): SetTemplate`, `readTemplate(raw: unknown, fiche: { sets: number; target_reps: number }): SetTemplate`, `templateError(t: SetTemplate): string | null`.
- Produces: `roundTo(value: number, step: number | undefined): number`, `plannedWeight(reference: number, pct: number, rounding?: number): number`.

- [ ] **Step 1: Tests qui échouent** — `methods.test.ts` :
  - `presetTemplate('top_backoff').sets` = `[{kind:'top',reps:5,pct:100}, 3 × {kind:'backoff',reps:8,pct:85}]` ; vérifier de même `ramp` (10@70,8@80,6@90,4@100), `dropset` (3×work 8@100, drop null@80, drop null@60), `myo_reps` (work 12-15@100, 4×restpause 3-5@100), `cluster` (12 × cluster 3@100), `amrap` (3×work 5@100, amrap 5@100), `double_progression` (3×work 8-12@100), `classic` (4×work 8@100) ; chaque `method` égal à son id.
  - `withWarmup(presetTemplate('classic')).sets.slice(0,2)` = warmup 8@50, warmup 5@70 ; `withWarmup` appliqué deux fois n'ajoute pas de doublon ; `withoutWarmup` les retire.
  - `roundTo(99.875, 2.5)` = 100 ; `roundTo(31, 2)` = 32 ; `roundTo(101.2, 0)` = 100 (0 → 2,5) ; `roundTo(101.2, undefined)` = 100 ; `plannedWeight(120, 85)` = 102.5.
  - `readTemplate(null, {sets:3,target_reps:10})` = classic 3×work 10@100 ; `readTemplate({method:'x', sets:'n'}, …)` = même chose ; `readTemplate({method:'top_backoff', sets:[{kind:'nope',reps:5,pct:100}]}, …)` = classic ; un modèle valide est rendu tel quel.
  - `templateError({method:'custom', sets:[{kind:'warmup',reps:5,pct:50}]})` = « Au moins une série qui compte » ; pct 0 ou 250 → « Pourcentage entre 1 et 200 » ; reps 0 ou 150 → « Répétitions entre 1 et 100 » ; repsMax < reps → « Fourchette invalide » ; modèle valide → null.
- [ ] **Step 2:** `npx vitest run src/domain/methods` → FAIL (module absent).
- [ ] **Step 3:** Implémenter `src/domain/methods.ts`.
- [ ] **Step 4:** `npx vitest run src/domain/methods` → PASS.
- [ ] **Step 5:** Commit `feat: modèles de séries et méthodes d'entraînement`.

### Task 2: Données — types, SQL 005, synchronisation

**Files:**
- Modify: `src/domain/types.ts` (UserExercise : `template?: SetTemplate | null`, `auto_progression?: boolean`, `rounding?: number` ; ProgramDayExercise : `template?: SetTemplate | null` ; WorkoutSet : `kind?: SetKind`, `target_reps: number | null`, `target_reps_max?: number | null`)
- Modify: `src/data/repo.ts` (`NUMERIC.user_exercises` ajoute `rounding`)
- Create: `supabase/migrations/005_methodes.sql` ; regénérer `supabase/setup_all.sql` (001→003, seed, 004, 005)
- Modify: `supabase/tests/rls_check.sql`
- Test: `src/data/repo.test.ts`

**Interfaces:**
- Consumes: `SetKind`, `SetTemplate` (Task 1).
- Produces: `setKind(s: WorkoutSet): SetKind` dans `src/domain/methods.ts` (`s.kind ?? 'work'`).

- [ ] **Step 1: Tests qui échouent** — `repo.test.ts` : `pull` avec une fiche distante `rounding: '2.50'` → locale `rounding === 2.5` ; `methods.test.ts` : `setKind({...set sans kind})` = 'work'.
- [ ] **Step 2:** `npx vitest run src/data/repo src/domain/methods` → FAIL.
- [ ] **Step 3:** Types, `NUMERIC`, `setKind`. SQL 005 : colonnes de la spec §5 ; `alter table workout_sets alter column target_reps drop not null` ; `check (kind in ('warmup','work','top','backoff','drop','restpause','cluster','amrap'))`. `rls_check.sql` : B (ami) lit `kind` d'une série de A ; insertion d'une série `kind = 'nope'` par A → `check_violation` ; insertion d'une série `target_reps` null acceptée.
- [ ] **Step 4:** `npx vitest run` → PASS ; `npx tsc -p .` → aucune erreur.
- [ ] **Step 5:** Commit `feat: colonnes des méthodes (SQL 005, types, synchro)`.

### Task 3: Construction d'une séance selon la méthode

**Files:**
- Modify: `src/domain/buildWorkout.ts`, `src/data/workouts.ts` (`startWorkout`, `addSet`)
- Test: `src/domain/buildWorkout.test.ts`, `src/data/workouts.test.ts`

**Interfaces:**
- Consumes: `readTemplate`, `plannedWeight`, `setKind` (Tasks 1–2).
- Produces: `buildWorkoutSets(workoutId: string, dayExercises: ProgramDayExercise[], fiches: Map<string, UserExercise>, lastSets?: Map<string, WorkoutSet[]>): WorkoutSet[]` — `lastSets` indexé par exercise_id, séries de la dernière séance terminée triées par position.

- [ ] **Step 1: Tests qui échouent** — `buildWorkout.test.ts` :
  - fiche 120 kg, `template = presetTemplate('top_backoff')` → 4 séries : top 5 @120, 3 × backoff 8 @102.5, `kind` et `target_reps` renseignés, `reps` pré-remplies 5/8, `done` false.
  - surcharge du jour `de.template = {method:'classic', sets:[4×work 10@80]}` sur la même fiche → 4 × 10 @ 96 (référence commune).
  - fiche sans `template`/`rounding`/`auto_progression` (ancienne) → comportement classique actuel (sets × target_reps @ current_weight).
  - série `reps: null` (dropset) → `target_reps` null, `reps` 0 ; `amrap` 5 → `target_reps` 5, `reps` 0 ; double progression 8-12 → `target_reps` 8, `target_reps_max` 12, `reps` 8.
  - mode manuel (`auto_progression: false`), modèle 3 séries, `lastSets` avec 2 séries à 70 et 72,5 → charges 70, 72.5, puis 3e calculée depuis la référence.
  - les tests existants de `buildWorkout.test.ts` restent verts.
  - `workouts.test.ts` : séance top set + back-off démarrée puis reprise (`getInProgress`) → mêmes `kind` dans le même ordre ; `addSet` sur un exercice dont la dernière série est `backoff` → nouvelle série `backoff`.
- [ ] **Step 2:** `npx vitest run src/domain/buildWorkout src/data/workouts` → FAIL.
- [ ] **Step 3:** Implémenter ; `startWorkout` charge `lastSetsFor` de chaque exercice pour le paramètre `lastSets`.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat: séances construites selon la méthode de chaque exercice`.

### Task 4: Progression selon le type de série

**Files:**
- Modify: `src/domain/progression.ts`, `src/data/workouts.ts` (`applyFinish`)
- Test: `src/domain/progression.test.ts`, `src/data/workouts.test.ts`

**Interfaces:**
- Consumes: `COUNTING_KINDS`, `setKind` (Task 1–2).
- Produces: `nextWeight(fiche, lastSets)` — même signature, nouvelle règle (spec §7).

- [ ] **Step 1: Tests qui échouent** — `progression.test.ts` :
  - top 5/5 réussi + 3 backoff 8/8 + échauffement non validé → +palier (l'échauffement ne compte pas).
  - drops non validés mais séries de travail réussies → +palier.
  - double progression : reps 12,12,11 sur 8-12 → inchangé ; 12,12,12 → +palier.
  - amrap cible 5 fait 7 → +palier ; fait 4 → inchangé.
  - série qui compte « échec » (`target_reps` null) validée avec 0 rep → réussie (pas de NaN).
  - uniquement des séries d'échauffement → inchangé (aucune série qui compte).
  - `auto_progression: false` → toujours inchangé.
  - tests existants verts.
  - `workouts.test.ts` : `finishWorkout` d'une fiche en mode manuel toutes séries réussies → `current_weight` inchangé.
- [ ] **Step 2:** `npx vitest run src/domain/progression src/data/workouts` → FAIL.
- [ ] **Step 3:** Implémenter.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat: progression selon le type de série, mode manuel`.

### Task 5: Éditeur de méthode et fiche

**Files:**
- Create: `src/features/exercises/MethodEditor.tsx`
- Modify: `src/features/exercises/ExerciseSheet.tsx`, `src/app/styles.css`
- Test: `src/features/exercises/MethodEditor.test.tsx`, `src/features/exercises/ExerciseSheet.test.tsx`

**Interfaces:**
- Consumes: Task 1.
- Produces: `<MethodEditor value: SetTemplate; reference: number; rounding?: number; onChange(t: SetTemplate): void />` — sélecteur de méthode (`<select aria-label="Méthode">`), case « Échauffement », une ligne par série (type, reps ou « échec », reps max optionnel, %), aperçu de la charge calculée, boutons « ＋ Série » et ✕ ; affiche `templateError`.

- [ ] **Step 1: Tests qui échouent** —
  - `MethodEditor` : choisir « Top set + back-off » → `onChange` avec `presetTemplate('top_backoff')` ; cocher « Échauffement » → `withWarmup` ; aperçu « 102,5 kg » pour un back-off 85 % d'une référence 120 ; modifier le % d'une série → `method: 'custom'` ; modèle sans série qui compte → message « Au moins une série qui compte » visible.
  - `ExerciseSheet` : interrupteur « Progression automatique » décoché + arrondi « 2 » + méthode top set → `save` reçoit `auto_progression: false`, `rounding: 2`, `template.method: 'top_backoff'` ; bouton Enregistrer désactivé si `templateError` ; tests existants verts.
- [ ] **Step 2:** `npx vitest run src/features/exercises` → FAIL.
- [ ] **Step 3:** Implémenter ; la fiche remplace les champs Séries / Reps visées par l'éditeur (le classique reste le défaut) et ajoute Arrondi + interrupteur.
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat: éditeur de méthode dans la fiche d'exercice`.

### Task 6: Méthode propre à un jour du programme

**Files:**
- Modify: `src/features/programs/ProgramEditor.tsx`, `src/data/programs.ts`
- Test: `src/data/programs.test.ts`

**Interfaces:**
- Consumes: `MethodEditor` (Task 5).
- Produces: `setDayExerciseTemplate(id: string, template: SetTemplate | null): Promise<void>` dans `src/data/programs.ts`.

- [ ] **Step 1: Test qui échoue** — `setDayExerciseTemplate(id, presetTemplate('classic'))` puis `null` → la ligne locale a le modèle puis `template` null, et chaque écriture est dans l'outbox.
- [ ] **Step 2:** `npx vitest run src/data/programs` → FAIL.
- [ ] **Step 3:** Implémenter ; dans l'éditeur de programme, sous chaque exercice d'un jour : « Méthode : identique à la fiche » ou le libellé de la méthode propre, qui ouvre une feuille avec `MethodEditor` (+ bouton « Revenir à la méthode de la fiche »).
- [ ] **Step 4:** `npx vitest run` → PASS.
- [ ] **Step 5:** Commit `feat: méthode propre à un exercice d'un jour`.

### Task 7: Écran de séance et détails

**Files:**
- Modify: `src/features/session/ExerciseCard.tsx`, `src/features/session/SessionPage.tsx`, `src/features/friends/WorkoutDetail.tsx`, `src/data/social.ts` (`fetchWorkoutDetail` renvoie `kind`), `src/features/profile/ProfilePage.tsx`, `src/app/styles.css`
- Test: `src/features/session/ExerciseCard.test.tsx`

**Interfaces:**
- Consumes: `KIND_LABELS`, `ATTACHED_KINDS`, `METHOD_LABELS`, `setKind`.
- Produces: `ExerciseCard` reçoit `methodLabel?: string` en plus des props actuelles.

- [ ] **Step 1: Tests qui échouent** — `ExerciseCard` avec un top set + 3 back-offs + 1 échauffement :
  - étiquettes « ÉCHAUF. », « TOP », « BACK-OFF » visibles ; en-tête contient « Top set + back-off » ;
  - une série `drop` a la classe `set-row attached` ;
  - une série `amrap` a un champ reps vide avec le placeholder « max » ;
  - une série double progression affiche « 8-12 » ;
  - tests existants verts (classique : « 4 × 8 à 62,5 kg »).
- [ ] **Step 2:** `npx vitest run src/features/session` → FAIL.
- [ ] **Step 3:** Implémenter ; le résumé d'en-tête regroupe les séries consécutives de même type/reps/charge (« 1 × 5 à 120 kg + 3 × 8 à 102,5 kg »).
- [ ] **Step 4:** `npx vitest run` → PASS ; `npm run build` → OK.
- [ ] **Step 5:** Commit `feat: étiquettes de méthode dans la séance et l'historique`.

### Task 8: Vérification, relecture, mise en ligne

- [ ] **Step 1:** `npx vitest run` → tout vert ; `npm run build` → OK.
- [ ] **Step 2:** Navigateur (session locale factice, vue mobile) : fiche squat en top set + back-off avec échauffement, jour 2 en classique 80 % ; séance jour 1 → étiquettes et charges ; terminer réussi → référence +2,5 ; séance jour 2 → charges recalculées ; mode manuel → pré-remplissage avec les charges réelles.
- [ ] **Step 3:** Relecture finale indépendante (executing-plans) et corrections.
- [ ] **Step 4:** L'utilisateur colle `005_methodes.sql` puis `rls_check.sql` (RLS OK) ; **ensuite** publication Vercel (accord explicite) et envoi GitHub.
