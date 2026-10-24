# App de musculation — Plan d'implémentation

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** PWA de suivi de programme de musculation, multi-utilisateurs, avec fiches d'exercices modifiables, progression automatique, mode hors ligne et fil d'amis.

**Architecture:** Front React/Vite/TS qui écrit d'abord dans IndexedDB (Dexie) puis synchronise vers Supabase via une file `outbox`. La logique métier est pure dans `src/domain/`. Les droits sont garantis par RLS dans Postgres.

**Tech Stack:** React 18, Vite 5, TypeScript, React Router 6, vite-plugin-pwa, Dexie 4, @supabase/supabase-js 2, Vitest, @testing-library/react, fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-24-app-musculation-design.md`

## Global Constraints

- Interface entièrement en français.
- Mobile d'abord : utilisable à 375 px de large, cibles tactiles ≥ 44 px.
- Tous les `id` sont des `uuid` générés côté client (`crypto.randomUUID()`).
- Toute écriture utilisateur passe par `src/data/repo.ts` (Dexie + outbox), jamais directement par Supabase — sauf les fonctions sociales et l'auth, qui exigent le réseau.
- Valeurs par défaut d'une fiche : `sets = 3`, `target_reps = 10`, `increment = 2.5`, `current_weight = 0`.
- `profiles.share_workouts` vaut `true` par défaut.
- Configuration Supabase via `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (`.env.local`, avec `.env.example` commité).
- Pas de Docker sur la machine : le SQL est appliqué via l'éditeur SQL Supabase, pas en local.

## Review Focus

1. **Saisie décimale à la française** (« 62,5 ») : doit être acceptée comme 62.5 partout où l'on saisit une charge. → test `parseWeight` en Task 2.
2. **Plus de reps que la cible** (10 au lieu de 8) : compte comme réussi et déclenche la hausse. → test en Task 2.
3. **Séance interrompue** (app fermée, rechargée) : la séance `in_progress` est reprise avec les séries déjà validées. → test en Task 8.
4. **Pseudo en double à la casse près** (« Léa » vs « léa ») : refusé. → index `lower(username)` + test RLS en Task 3.
5. **Demande d'ami à soi-même ou en double inversé** (A→B alors que B→A existe) : refusée. → contrainte + test en Task 3.

---

### Task 1: Squelette de l'app (Vite, PWA, navigation, tests)

**Files:**
- Create: `package.json`, `vite.config.ts`, `tsconfig.json`, `index.html`, `.env.example`, `.gitignore`
- Create: `src/main.tsx`, `src/app/App.tsx`, `src/app/TabBar.tsx`, `src/app/styles.css`
- Create: `src/features/{session,programs,exercises,friends,profile}/*Page.tsx` (pages vides avec titre)
- Create: `public/icon-192.png`, `public/icon-512.png` (icône simple générée)
- Test: `src/app/App.test.tsx`

**Interfaces:**
- Produces: routes `/` (Séance), `/programmes`, `/exercices`, `/amis`, `/profil` ; `<TabBar />` avec les libellés « Séance », « Programmes », « Mes exercices », « Amis » ; lien Profil dans l'en-tête.

- [ ] **Step 1:** Scaffold Vite React-TS, installer les dépendances de la stack, configurer Vitest (`environment: 'jsdom'`, setup `@testing-library/jest-dom`, `fake-indexeddb/auto`) et `vite-plugin-pwa` (manifest `name: "Muscu"`, `display: standalone`, `registerType: autoUpdate`).
- [ ] **Step 2: Test qui échoue** — `App.test.tsx` : rendu de `<App />` sous `MemoryRouter` → les 4 libellés d'onglets sont présents ; clic sur « Mes exercices » → titre « Mes exercices » visible.
- [ ] **Step 3:** Run `npx vitest run src/app` → FAIL.
- [ ] **Step 4:** Implémenter `App`, `TabBar` (barre fixe en bas, onglet actif mis en évidence), pages vides.
- [ ] **Step 5:** Run `npx vitest run src/app` → PASS ; `npm run build` → succès, `dist/manifest.webmanifest` présent.
- [ ] **Step 6:** Commit `feat: squelette PWA et navigation par onglets`.

### Task 2: Logique métier pure

**Files:**
- Create: `src/domain/types.ts`, `src/domain/progression.ts`, `src/domain/rotation.ts`, `src/domain/buildWorkout.ts`, `src/domain/parseWeight.ts`
- Test: `src/domain/*.test.ts`

**Interfaces:**
- Produces (dans `types.ts`) : `Exercise {id, owner_id|null, name, muscle_group}`, `UserExercise {id, user_id, exercise_id, current_weight, sets, target_reps, increment, updated_at}`, `Program {id, owner_id, name, is_active, share_code|null, updated_at}`, `ProgramDay {id, program_id, position, name}`, `ProgramDayExercise {id, day_id, exercise_id, position}`, `Workout {id, user_id, program_day_id, started_at, finished_at|null, status: 'in_progress'|'done', updated_at}`, `WorkoutSet {id, workout_id, exercise_id, position, target_reps, reps, weight, done}`, `Profile {user_id, username, display_name, share_workouts, unit: 'kg'|'lb'}`.
- Produces : `nextWeight(fiche: UserExercise, lastSets: WorkoutSet[]): number`
- Produces : `nextDay(days: ProgramDay[], lastDoneDayId: string | null): ProgramDay | null`
- Produces : `buildWorkoutSets(workoutId: string, dayExercises: ProgramDayExercise[], fiches: Map<string, UserExercise>): WorkoutSet[]` — `fiche.sets` séries par exercice, pré-remplies `reps = target_reps`, `weight = current_weight`, `done = false`.
- Produces : `parseWeight(input: string): number | null`

- [ ] **Step 1: Tests qui échouent**
  - `nextWeight` : fiche `{current_weight: 60, increment: 2.5, target_reps: 8}` + 4 séries `done`, reps `[8,8,8,8]` → `62.5` ; reps `[8,8,7,8]` → `60` ; une série `done=false` → `60` ; reps `[10,9,8,8]` → `62.5` ; `lastSets = []` → `60`.
  - `nextDay` : jours positions 0,1,2 ; `null` → jour 0 ; dernier = jour 1 → jour 2 ; dernier = jour 2 → jour 0 ; id inconnu → jour 0 ; `[]` → `null`.
  - `buildWorkoutSets` : 2 exercices, fiches 3×10@40 et 4×8@60 → 7 séries, positions 0..6, valeurs pré-remplies ; exercice sans fiche → valeurs par défaut (3×10@0).
  - `parseWeight` : `"62,5"` → 62.5 ; `"62.5"` → 62.5 ; `" 80 "` → 80 ; `""` → null ; `"abc"` → null ; `"-5"` → null.
- [ ] **Step 2:** Run `npx vitest run src/domain` → FAIL.
- [ ] **Step 3:** Implémenter. `nextWeight` arrondit au centième pour éviter `62.50000001`.
- [ ] **Step 4:** Run `npx vitest run src/domain` → PASS.
- [ ] **Step 5:** Commit `feat: logique de progression, rotation des jours et construction de séance`.

### Task 3: Schéma Supabase et RLS

**Files:**
- Create: `supabase/migrations/001_schema.sql`, `supabase/migrations/002_rls.sql`, `supabase/migrations/003_functions.sql`, `supabase/seed_exercises.sql`
- Test: `supabase/tests/rls_check.sql`
- Create: `docs/SETUP.md` (créer le projet Supabase, coller les scripts dans l'ordre, remplir `.env.local`)

**Interfaces:**
- Produces : les tables de la spec §4, colonnes identiques aux types de Task 2.
- Produces RPC : `import_program(code text) returns uuid` (id du nouveau programme), `share_program(program_id uuid) returns text` (code de 8 caractères, idempotent), `delete_my_account() returns void`, `search_profiles(q text) returns setof profiles` (préfixe insensible à la casse, 20 max, exclut soi).
- Produces vue : `friend_feed` — séances `done` des amis acceptés partageant, avec `username`, `day_name`, `exercise_count`, `duration_min`, `reaction_count`, `reacted_by_me`.

- [ ] **Step 1:** `001_schema.sql` : tables, clés étrangères `on delete cascade`, `unique (user_id, exercise_id)` sur `user_exercises`, index unique `lower(username)`, `check (requester_id <> addressee_id)` et index unique sur `(least(requester_id, addressee_id), greatest(...))` dans `friendships`, trigger `updated_at`, trigger de création de `profiles` à l'inscription (username = `'user_' || left(id::text, 8)` provisoire).
- [ ] **Step 2:** `002_rls.sql` : politiques exactes de la spec §4 « Règles d'accès ». Fonction helper `is_friend(a uuid, b uuid) returns boolean` (security definer). Pour `friendships` en update : `using (addressee_id = auth.uid())` et `with check (status = 'accepted')`.
- [ ] **Step 3:** `003_functions.sql` : les RPC ci-dessus (security definer, `search_path` fixé). `import_program` crée les `user_exercises` manquants avec les valeurs par défaut des Global Constraints. Vue `friend_feed` en `security_invoker = true`.
- [ ] **Step 4:** `seed_exercises.sql` : ~30 exercices courants du catalogue global (squat, développé couché, soulevé de terre, tractions, rowing barre, développé militaire, etc.).
- [ ] **Step 5: Test RLS** — `rls_check.sql` crée 3 utilisateurs A, B, C dans une transaction, simule chacun via `set local role authenticated; set local request.jwt.claims = ...`, et `raise exception` si une assertion échoue :
  - B (ami accepté de A) voit la séance de A ; C (non ami) ne la voit pas.
  - A passe `share_workouts = false` → B ne la voit plus.
  - B ne peut pas modifier la séance de A.
  - A ne peut pas accepter sa propre demande envoyée à B.
  - insertion d'un pseudo « LEA » quand « lea » existe → erreur.
  - demande B→A quand A→B existe → erreur ; demande A→A → erreur.
  - Se termine par `rollback`, affiche `RLS OK`.
- [ ] **Step 6:** Vérification : l'utilisateur colle 001→003 + seed puis `rls_check.sql` dans l'éditeur SQL Supabase → sortie `RLS OK`. (Bloquant : nécessite le projet Supabase de l'utilisateur.)
- [ ] **Step 7:** Commit `feat: schéma Supabase, RLS et fonctions`.

### Task 4: Couche de données locale et synchronisation

**Files:**
- Create: `src/data/supabase.ts`, `src/data/db.ts`, `src/data/repo.ts`, `src/data/sync.ts`, `src/data/useLive.ts`
- Test: `src/data/repo.test.ts`, `src/data/sync.test.ts`

**Interfaces:**
- Consumes : types de Task 2.
- Produces : `db` (Dexie, une table par entité + `outbox {seq++, table, op: 'upsert'|'delete', row, attempts}`).
- Produces : `repo.put<T>(table: TableName, row: T): Promise<void>` (met `updated_at = now`, écrit en local, ajoute à l'outbox) ; `repo.remove(table, id)` ; `repo.pull(userId): Promise<void>` (récupère les données de l'utilisateur et remplace le cache si `updated_at` distant ≥ local).
- Produces : `createSync(client: SyncClient): { flush(): Promise<void>, start(): () => void }` avec `SyncClient = { upsert(table, rows): Promise<{error}>, delete(table, ids): Promise<{error}> }`. `start` écoute `online` et lance `flush` au démarrage.
- Produces : `useLive<T>(query: () => Promise<T>, deps): T | undefined` (wrapper `useLiveQuery` de dexie-react-hooks).
- Produces : `useSyncStatus(): { pending: number }`.

- [ ] **Step 1: Tests qui échouent**
  - `repo.put` écrit la ligne dans la table locale et ajoute une entrée outbox `upsert`.
  - `flush` avec faux client OK → appelle `upsert` dans l'ordre de `seq`, vide l'outbox.
  - `flush` avec faux client en erreur → l'entrée reste, `attempts` incrémenté ; un second `flush` OK la vide.
  - Deux `put` de la même ligne avant `flush` → un seul upsert, avec la dernière valeur.
- [ ] **Step 2:** Run `npx vitest run src/data` → FAIL.
- [ ] **Step 3:** Implémenter. Délai entre tentatives : `min(2^attempts, 60)` secondes, géré par `start`.
- [ ] **Step 4:** Run `npx vitest run src/data` → PASS.
- [ ] **Step 5:** Commit `feat: stockage local Dexie et synchronisation par outbox`.

### Task 5: Authentification et premier lancement

**Files:**
- Create: `src/features/auth/AuthProvider.tsx`, `src/features/auth/LoginPage.tsx`, `src/features/auth/OnboardingPage.tsx`
- Modify: `src/app/App.tsx` (garde : non connecté → `/connexion` ; pseudo provisoire `user_…` → `/bienvenue`)
- Test: `src/features/auth/OnboardingPage.test.tsx`

**Interfaces:**
- Consumes : `supabase` (Task 4), `repo.pull`, `createSync(...).start`.
- Produces : `useAuth(): { user: { id: string } | null, profile: Profile | null, refreshProfile(): Promise<void>, signOut(): Promise<void> }`.

- [ ] **Step 1: Test qui échoue** — `OnboardingPage` : pseudo de moins de 3 caractères → message « 3 caractères minimum » et pas d'appel réseau ; pseudo déjà pris (faux client renvoie l'erreur Postgres `23505`) → « Ce pseudo est déjà pris ».
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter : `LoginPage` (bascule Connexion / Inscription, email + mot de passe) ; `OnboardingPage` (pseudo `^[a-zA-Z0-9_.]{3,20}$`, puis choix « Créer un programme » → `/programmes` ou « Importer un code » → `/programmes?import=1`) ; `AuthProvider` lance `repo.pull` et la sync une fois connecté. Session expirée → `/connexion` sans vider Dexie.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: connexion, inscription et choix du pseudo`.

### Task 6: Onglet « Mes exercices »

**Files:**
- Create: `src/features/exercises/ExercisesPage.tsx`, `src/features/exercises/ExerciseSheet.tsx`, `src/features/exercises/ExercisePicker.tsx`, `src/features/exercises/WeightInput.tsx`
- Test: `src/features/exercises/ExerciseSheet.test.tsx`

**Interfaces:**
- Consumes : `repo.put`, `useLive`, `parseWeight`.
- Produces : `<ExercisePicker onPick={(exercise: Exercise) => void} />` (recherche dans catalogue global + exercices perso, bouton « Créer “<texte>” ») — réutilisé en Task 7.
- Produces : `ensureFiche(userId, exerciseId): Promise<UserExercise>` (crée la fiche par défaut si absente) dans `src/data/repo.ts`.
- Produces : `<WeightInput value onChange />` (accepte la virgule, `inputMode="decimal"`) — réutilisé en Task 8.

- [ ] **Step 1: Test qui échoue** — `ExerciseSheet` : saisir « 62,5 » dans Charge puis Enregistrer → `repo.put('user_exercises', …)` appelé avec `current_weight: 62.5` ; saisir « abc » → bouton Enregistrer désactivé et message « Charge invalide ».
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter la liste (nom, « 3 × 10 · 62,5 kg · +2,5 »), la fiche modifiable (charge, séries, reps visées, palier) et les 5 dernières performances de l'exercice (séries `done` des séances `done`). Bouton « Ajouter un exercice » via `ExercisePicker` + `ensureFiche`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: onglet Mes exercices avec fiches modifiables`.

### Task 7: Onglet « Programmes »

**Files:**
- Create: `src/features/programs/ProgramsPage.tsx`, `src/features/programs/ProgramEditor.tsx`, `src/features/programs/ShareDialog.tsx`, `src/features/programs/ImportDialog.tsx`, `src/data/programs.ts`
- Test: `src/data/programs.test.ts`

**Interfaces:**
- Consumes : `repo`, `ExercisePicker`, `ensureFiche`, RPC `share_program`, `import_program`.
- Produces : dans `src/data/programs.ts` : `setActiveProgram(userId, programId): Promise<void>` (un seul actif), `addDay(programId, name): Promise<ProgramDay>`, `moveDay(dayId, delta: -1|1)`, `addDayExercise(dayId, exerciseId): Promise<ProgramDayExercise>`, `moveDayExercise(id, delta)`, `getActiveProgram(userId): Promise<{program, days: ProgramDay[], exercisesByDay: Map<string, ProgramDayExercise[]>} | null>`.

- [ ] **Step 1: Tests qui échouent** — `setActiveProgram` sur B quand A est actif → A `is_active=false`, B `true` ; `addDayExercise` crée la fiche si absente et réutilise l'existante sinon ; `moveDay(+1)` sur le dernier jour → positions inchangées.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter les fonctions, puis les écrans : liste avec badge « Actif », éditeur (renommer, jours, exercices par jour, réordonner, supprimer), Partager (affiche le code + bouton copier ; nécessite le réseau), Importer (champ code ; `?import=1` ouvre le dialogue ; après import → `repo.pull`).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: création, partage et import de programmes`.

### Task 8: Onglet « Séance »

**Files:**
- Create: `src/features/session/SessionPage.tsx`, `src/features/session/ExerciseCard.tsx`, `src/data/workouts.ts`
- Test: `src/data/workouts.test.ts`, `src/features/session/ExerciseCard.test.tsx`

**Interfaces:**
- Consumes : `getActiveProgram`, `nextDay`, `buildWorkoutSets`, `nextWeight`, `WeightInput`, `repo`.
- Produces : dans `src/data/workouts.ts` : `getInProgress(userId): Promise<Workout | null>`, `startWorkout(userId, day: ProgramDay): Promise<Workout>`, `updateSet(set: WorkoutSet): Promise<void>`, `finishWorkout(workoutId): Promise<void>` (statut `done`, `finished_at`, puis pour chaque exercice applique `nextWeight` sur la fiche via `repo.put`), `lastSetsFor(userId, exerciseId): Promise<WorkoutSet[]>`.

- [ ] **Step 1: Tests qui échouent**
  - `startWorkout` puis `getInProgress` → renvoie la même séance avec ses séries (simule un rechargement : nouvelle instance de lecture, même Dexie).
  - `finishWorkout` avec toutes séries réussies sur fiche 60 kg/+2,5 → fiche à 62.5 ; avec une série ratée → 60.
  - `ExerciseCard` : affiche « 4 × 8 à 62,5 kg » et « Dernière fois : 60 kg · 8, 8, 8, 8 » ; clic sur ✓ d'une série → `updateSet` avec `done: true`.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter. Accueil : séance en cours → « Reprendre » ; sinon prochain jour (`nextDay` d'après la dernière séance `done`) + « Commencer » ; pas de programme actif → lien vers Programmes. En séance : cartes, flèche ↑ si `current_weight` > charge de la dernière fois, bouton « Terminer » (confirmation si des séries ne sont pas validées), « Abandonner » (supprime la séance).
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: séance guidée avec progression automatique`.

### Task 9: Onglet « Amis »

**Files:**
- Create: `src/features/friends/FriendsPage.tsx`, `src/features/friends/FeedItem.tsx`, `src/features/friends/WorkoutDetail.tsx`, `src/features/friends/FriendsManager.tsx`, `src/data/social.ts`
- Test: `src/features/friends/FeedItem.test.tsx`

**Interfaces:**
- Consumes : `supabase`, vue `friend_feed`, RPC `search_profiles`, `useAuth`.
- Produces : dans `src/data/social.ts` (appels réseau directs) : `fetchFeed(before?: string): Promise<FeedEntry[]>` (20 par page, cache du dernier résultat dans `localStorage` sous `muscu.feed`), `toggleReaction(workoutId, reacted: boolean)`, `searchProfiles(q)`, `sendRequest(userId)`, `respondRequest(id, accept: boolean)`, `removeFriend(friendshipId)`, `listFriendships(): Promise<{incoming, outgoing, friends}>`, `fetchWorkoutDetail(workoutId)`.

- [ ] **Step 1: Test qui échoue** — `FeedItem` : affiche pseudo, nom du jour, « 5 exercices · 42 min », « 💪 3 » ; clic sur 💪 non réagi → compteur passe à 4 immédiatement et `toggleReaction(id, true)` appelé ; si l'appel échoue → retour à 3.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter le fil (chargement de la page suivante en bas), le détail d'une séance, le gestionnaire (recherche avec délai 300 ms, demandes reçues avec badge sur l'onglet, liste d'amis avec « Retirer »). Hors ligne : fil en cache + bandeau « Hors ligne ».
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: onglet Amis avec fil et réactions`.

### Task 10: Profil et paramètres

**Files:**
- Create: `src/features/profile/ProfilePage.tsx`, `src/features/profile/SettingsSection.tsx`, `src/app/SyncBadge.tsx`
- Modify: `src/app/App.tsx` (en-tête : lien Profil + `SyncBadge`)
- Test: `src/features/profile/SettingsSection.test.tsx`

**Interfaces:**
- Consumes : `useAuth`, `useSyncStatus`, RPC `delete_my_account`, `repo`.

- [ ] **Step 1: Test qui échoue** — l'interrupteur « Partager mes séances avec mes amis » est coché quand `share_workouts = true` ; le décocher → mise à jour de `profiles` avec `share_workouts: false` ; « Supprimer mon compte » demande de taper le pseudo avant d'activer la confirmation.
- [ ] **Step 2:** Run → FAIL.
- [ ] **Step 3:** Implémenter : historique de mes séances (date, jour, résumé, détail), pseudo modifiable (mêmes règles que Task 5), partage, unité kg/lb (affichage uniquement, stockage en kg), déconnexion, suppression (RPC puis vidage de Dexie). `SyncBadge` affiche « non synchronisé (n) » si `pending > 0`.
- [ ] **Step 4:** Run → PASS.
- [ ] **Step 5:** Commit `feat: profil, paramètres et indicateur de synchronisation`.

### Task 11: Vérification de bout en bout

- [ ] **Step 1:** `npx vitest run` → tous verts ; `npm run build` → succès.
- [ ] **Step 2:** Avec `.env.local` rempli, `npm run dev`, vue mobile 375 px : inscription de deux comptes, pseudo, création d'un programme 2 jours, fiches, séance complète → charge augmentée dans Mes exercices ; demande d'ami acceptée → séance visible dans le fil, 💪 ; désactiver le partage → séance disparue chez l'autre ; partage puis import d'un programme.
- [ ] **Step 3:** Hors ligne (DevTools → Offline) : commencer et terminer une séance, recharger la page → séance conservée ; repasser en ligne → badge « non synchronisé » disparaît, séance présente dans Supabase.
- [ ] **Step 4:** Commit des correctifs éventuels.
