# Calendrier d'entraînement (étape 1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Un onglet Calendrier (vues mois et semaine) qui affiche séances faites, prévues, manquées, reportées, repos et objectif hebdomadaire, avec déplacement / ajout / repos forcé.

**Architecture:** Trois petites tables synchronisées (jours d'entraînement, exceptions par date, objectifs par semaine) passent par le mécanisme existant (Dexie + outbox + pull). Tout le planning est calculé à l'affichage par des fonctions pures (`src/domain/calendar.ts`) à partir de ces tables, des séances terminées et de la rotation du programme actif (`nextDay`). L'UI vit dans `src/features/calendar/`.

**Tech Stack:** React 18, TypeScript, Dexie 4, Supabase (Postgres + RLS), Vitest + Testing Library + fake-indexeddb.

**Spec:** `docs/superpowers/specs/2026-10-24-calendrier-design.md`

## Global Constraints

- Dates : chaînes locales `YYYY-MM-DD` ; semaine du lundi au dimanche ; jours de la semaine 1 (lundi) … 7 (dimanche).
- Couleurs d'état : vert `done`, bleu `planned`, gris `rest`, rouge `missed`, orange `moved`.
- Toute écriture passe par `repo.put` / `repo.remove` (jamais d'écriture Dexie directe hors tests).
- Libellés exacts : « Calendrier », « Quels jours tu t'entraînes ? », « Valider », « Aujourd'hui », « Mois », « Semaine », « Commencer », « Déplacer », « Passer en repos », « Ajouter une séance ce jour », « Annuler le report », « Séance libre », « Jour de repos aujourd'hui », « Séance manquée — elle a glissé au prochain jour d'entraînement », « Par défaut ».
- Pas de jour `missed` avant `since`. Le calendrier n'est pas visible des amis.
- Inputs ≥ 16 px (pas de zoom iOS) ; la page tient à 375 px sans défilement horizontal.
- Le script 006 doit être exécuté dans Supabase avant toute publication.

## Review Focus

- Changement de mois / d'année et semaine à cheval sur deux mois : `addDays`, `weekStart` sur 31 déc. → 1ᵉʳ janv. et sur changement d'heure (fin mars / fin octobre) — doit rester exact (calcul sur dates locales à midi, pas sur des millisecondes de minuit).
- Séance terminée juste après minuit ou commencée la veille : la date retenue est celle de `started_at` en local.
- Programme actif sans jour, ou aucun programme : jours prévus « Séance libre », pas de plantage.
- Déplacer vers un jour qui avait déjà une exception (ex. jour passé en repos) : l'exception est remplacée, une seule par date.
- Aucun jour d'entraînement coché : « Valider » désactivé ; objectif par défaut 0 jamais « atteint ».

---

### Task 1: Calcul du calendrier (domaine pur)

**Files:**
- Modify: `src/domain/types.ts` (ajouter les 3 types)
- Create: `src/domain/calendar.ts`
- Test: `src/domain/calendar.test.ts`

**Interfaces:**
- Consumes: `nextDay(days, lastDoneDayId)` de `src/domain/rotation.ts` ; `Workout`, `ProgramDay`.
- Produces (types dans `types.ts`) :
  ```ts
  export interface TrainingSchedule { id: string; user_id: string; weekdays: number[]; since: string; updated_at?: string }
  export interface ScheduleOverride { id: string; user_id: string; date: string; kind: 'train' | 'rest'; moved_to: string | null; updated_at?: string }
  export interface WeeklyGoal { id: string; user_id: string; week_start: string; sessions: number; updated_at?: string }
  ```
- Produces (`calendar.ts`) :
  ```ts
  export function toISODate(d: Date): string            // date locale
  export function addDays(date: string, n: number): string
  export function weekStart(date: string): string       // lundi
  export function weekday(date: string): number         // 1..7
  export function workoutDate(w: Workout): string       // date locale de started_at
  export type DayState = 'done' | 'planned' | 'rest' | 'missed' | 'moved'
  export interface CalendarInput {
    today: string
    schedule: TrainingSchedule
    overrides: ScheduleOverride[]
    goals: WeeklyGoal[]
    workouts: Workout[]          // séances terminées uniquement
    days: ProgramDay[]           // jours du programme actif ([] si aucun)
    lastDoneDayId: string | null
  }
  export interface CalendarDay {
    date: string
    state: DayState
    day: ProgramDay | null       // séance attribuée (planned) ; null = « Séance libre » ou sans objet
    workouts: Workout[]          // séances terminées ce jour
    movedTo: string | null
  }
  export function isPlanned(date: string, input: CalendarInput): boolean
  export function buildCalendar(input: CalendarInput, from: string, to: string): CalendarDay[]  // bornes incluses
  export function weekProgress(input: CalendarInput, monday: string): { done: number; goal: number; reached: boolean }
  ```

- [ ] **Step 1: Write the failing tests** (`calendar.test.ts`)

Fixture : `schedule = { weekdays: [1, 3, 5], since: '2026-10-01' }` (lun/mer/ven), `days = [A, B, C]` (positions 0,1,2), `today = '2026-10-21'` (mercredi). `w(date, dayId)` fabrique une séance `done` commencée à 18 h locales ce jour.

```ts
test('dates : addDays franchit mois, année et changement d’heure', () => {
  expect(addDays('2026-12-31', 1)).toBe('2027-01-01')
  expect(addDays('2026-10-24', 2)).toBe('2026-10-26')   // passage à l'heure d'hiver le 25
  expect(addDays('2026-03-01', -1)).toBe('2026-02-28')
  expect(weekStart('2026-10-25')).toBe('2026-10-19')     // dimanche → lundi précédent
  expect(weekStart('2027-01-01')).toBe('2026-12-28')
  expect(weekday('2026-10-25')).toBe(7)
})
test('passé : fait, manqué, repos ; rien de manqué avant since', () => {
  // lun 19 fait (A), ven 16 sans séance, lun 28 sept (avant since) sans séance
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }, '2026-09-28', '2026-10-20')
  expect(state(cal, '2026-10-19')).toBe('done')
  expect(state(cal, '2026-10-16')).toBe('missed')
  expect(state(cal, '2026-09-28')).toBe('rest')
  expect(state(cal, '2026-10-20')).toBe('rest')
})
test('une séance un jour non prévu est « fait »', () => { /* mar 20 avec séance → 'done' */ })
test('futur : rotation à la suite du dernier jour fait, la séance ratée glisse', () => {
  // dernier fait = A (lun 19) ; ven 16 manqué ne change rien ; mer 21 (aujourd'hui) = B, ven 23 = C, lun 26 = A
  const cal = buildCalendar({ ...base, workouts: [w('2026-10-19', 'A')], lastDoneDayId: 'A' }, '2026-10-21', '2026-10-26')
  expect(dayOf(cal, '2026-10-21')).toBe('B'); expect(dayOf(cal, '2026-10-23')).toBe('C'); expect(dayOf(cal, '2026-10-26')).toBe('A')
})
test('aujourd’hui déjà fait : la rotation reprend au jour prévu suivant', () => { /* mer 21 done (B, lastDone B) → ven 23 = C */ })
test('report : origine « moved » avec movedTo, arrivée prévue avec la séance', () => {
  // overrides : rest 23 moved_to 24, train 24 → 23 'moved' movedTo '2026-10-24' ; 24 'planned' day C
})
test('ajout et repos forcé', () => { /* train mar 22 → planned ; rest lun 26 sans moved_to → rest ; la rotation saute 26 */ })
test('plusieurs séances le même jour : un seul jour fait, compté une fois', () => { /* 2 séances lun 19 → weekProgress done = 1 */ })
test('sans programme : jours prévus « Séance libre » (day null)', () => { /* days [] → planned, day null */ })
test('objectif : défaut = nombre de jours, surcharge, atteint', () => {
  expect(weekProgress(input, '2026-10-19')).toEqual({ done: 1, goal: 3, reached: false })
  // goal surchargé à 1 → reached true ; weekdays [] et pas de surcharge → goal 0, reached false
})
```

- [ ] **Step 2: Run to verify it fails** — `npx vitest run src/domain/calendar.test.ts` → FAIL (module introuvable).

- [ ] **Step 3: Implement `calendar.ts`**

Dates : construire `new Date(y, m - 1, d, 12)` (midi local) pour `addDays` / `weekday` afin d'éviter les sauts d'heure. `buildCalendar` : index des exceptions par date et des séances par `workoutDate` ; état selon le tableau du §4 de la spec (ordre : done → moved → missed → planned → rest ; `missed` exige `date < today` et `date >= since`). Rotation : parcourir les dates de `today` à `to` (même si `from > today`) ; un jour prévu non `done` reçoit `cur`, puis `cur = nextDay(days, cur.id)` ; `cur` démarre à `nextDay(days, lastDoneDayId)` ; `days = []` → `day: null`. `weekProgress` : `done` = nombre de dates de la semaine avec au moins une séance ; `goal` = objectif de `goals` pour ce lundi sinon `weekdays.length` ; `reached = goal > 0 && done >= goal`.

- [ ] **Step 4: Run** — `npx vitest run src/domain/calendar.test.ts` → PASS.

- [ ] **Step 5: Commit** — `git add src/domain && git commit -m "feat(calendrier): calcul des jours et des objectifs"`

### Task 2: Données — migration 006, tables locales, actions

**Files:**
- Create: `supabase/migrations/006_calendrier.sql` ; régénérer `supabase/setup_all.sql` (001→003, seed, 004, 005, 006 ; mettre à jour la ligne « Généré à partir de … 001→006 »)
- Modify: `supabase/tests/rls_check.sql`, `src/data/db.ts`, `src/data/repo.ts`
- Create: `src/data/calendar.ts`
- Test: `src/data/calendar.test.ts`, `src/data/repo.test.ts`

**Interfaces:**
- Consumes: types de Task 1 ; `repo.put/remove`, `pull`, `lastDoneDayId`, `getActiveProgram`.
- Produces (`src/data/calendar.ts`) :
  ```ts
  export async function getSchedule(userId: string): Promise<TrainingSchedule | undefined>   // id = userId
  export async function saveWeekdays(userId: string, weekdays: number[], today: string): Promise<void>  // since conservé s'il existe
  export async function moveSession(userId: string, from: string, to: string): Promise<void>
  export async function cancelMove(userId: string, from: string): Promise<void>
  export async function setRest(userId: string, date: string): Promise<void>
  export async function addSession(userId: string, date: string): Promise<void>
  export async function setWeeklyGoal(userId: string, monday: string, sessions: number | null): Promise<void>  // null = par défaut (supprime)
  export async function loadCalendarInput(userId: string, today: string): Promise<CalendarInput | null>  // null si pas de schedule
  ```
- `SyncedTable` gagne `'training_schedules' | 'schedule_overrides' | 'weekly_goals'`.

- [ ] **Step 1: Migration 006**

```sql
create table public.training_schedules (
  id uuid primary key references auth.users(id) on delete cascade,
  user_id uuid not null unique references auth.users(id) on delete cascade check (user_id = id),
  weekdays smallint[] not null default '{}' check (weekdays <@ array[1,2,3,4,5,6,7]::smallint[]),
  since date not null default current_date,
  updated_at timestamptz not null default now()
);
create table public.schedule_overrides (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  kind text not null check (kind in ('train', 'rest')),
  moved_to date check (moved_to is null or (kind = 'rest' and moved_to <> date)),
  updated_at timestamptz not null default now(),
  unique (user_id, date)
);
create table public.weekly_goals (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week_start date not null check (extract(isodow from week_start) = 1),
  sessions smallint not null check (sessions between 0 and 14),
  updated_at timestamptz not null default now(),
  unique (user_id, week_start)
);
```
Puis pour chaque table : `enable row level security` et une politique `for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())`.

- [ ] **Step 2: Étendre `rls_check.sql`** (avant « Suppression du compte de A ») : en postgres, insérer pour A un schedule `{1,3,5}`, une exception et un objectif ; en B : `if exists (select 1 from training_schedules|schedule_overrides|weekly_goals where user_id = A)` → `ÉCHEC : B ne doit pas voir le calendrier de A` ; insertion par B d'une exception avec `user_id = A` doit lever une erreur (bloc `begin … exception when others then null; end` qui sinon lève `ÉCHEC : B ne doit pas écrire dans le calendrier de A`) ; contraintes : `weekdays '{8}'` et `week_start` un mardi refusés. Régénérer `setup_all.sql`.

- [ ] **Step 3: Write the failing tests**

`repo.test.ts` : un `pull` avec une source factice renvoyant une ligne de chacune des 3 tables les recopie dans Dexie.

`calendar.test.ts` (données) :
```ts
test('saveWeekdays crée le réglage avec since = aujourd’hui, puis le garde', async () => {
  await saveWeekdays('u', [1, 3], '2026-10-21'); await saveWeekdays('u', [2], '2026-10-25')
  expect(await getSchedule('u')).toMatchObject({ id: 'u', weekdays: [2], since: '2026-10-21' })
})
test('déplacer puis annuler', async () => {
  await moveSession('u', '2026-10-23', '2026-10-24')
  // 2 exceptions : rest 23 moved_to 24, train 24 ; 2 entrées outbox
  await cancelMove('u', '2026-10-23')   // plus aucune exception
})
test('déplacer vers un jour qui avait une exception la remplace', async () => { /* setRest 24 puis move 23→24 → une seule exception le 24, kind train */ })
test('passer en repos un jour ajouté supprime l’ajout ; ajouter un jour en repos forcé supprime le repos', async () => {})
test('objectif : création, modification, retour au défaut', async () => { /* setWeeklyGoal 4, puis 2 (même id), puis null → aucune ligne */ })
test('loadCalendarInput : null sans réglage ; séances terminées seulement', async () => {})
```

- [ ] **Step 4: Run** — `npx vitest run src/data` → FAIL.

- [ ] **Step 5: Implement**

`db.ts` : `version(3).stores({ training_schedules: 'id, user_id', schedule_overrides: 'id, user_id, date', weekly_goals: 'id, user_id, week_start' })` + tables typées. `repo.ts` : ajouter les 3 tables à `PULL_ORDER` (sans parent) et à `OWNER_COL` (`user_id`). `data/calendar.ts` : une exception existante pour `(user, date)` est retrouvée via l'index `date` filtré par `user_id` et réutilisée (même `id`) pour la remplacer ; suppressions via `repo.remove`. `loadCalendarInput` assemble schedule, exceptions, objectifs, séances `status === 'done'` de l'utilisateur, `getActiveProgram(userId)?.days ?? []`, `lastDoneDayId`.

- [ ] **Step 6: Run** — `npx vitest run src/data` → PASS.

- [ ] **Step 7: Commit** — `git add supabase src/data && git commit -m "feat(calendrier): tables, synchro et actions"`

### Task 3: Écran Calendrier

**Files:**
- Create: `src/features/calendar/CalendarPage.tsx`, `WeekdaysSetup.tsx`, `MonthView.tsx`, `WeekView.tsx`, `DaySheet.tsx`
- Modify: `src/app/TabBar.tsx` (onglet `{ to: '/calendrier', label: 'Calendrier', icon: '▦' }` en 2ᵉ position), `src/app/App.tsx` (route), `src/app/styles.css`
- Test: `src/features/calendar/CalendarPage.test.tsx`

**Interfaces:**
- Consumes: Task 1 (`buildCalendar`, `weekProgress`, `weekStart`, `addDays`, `toISODate`), Task 2 (actions, `loadCalendarInput`), `useLive`, `useUserId`, `Sheet`, `startWorkout`, `getActiveProgram` (exercices d'un jour), `setsOf` (résumé d'une séance faite).
- Produces: `CalendarPage` (route `/calendrier`) ; `WeekdaysSetup({ initial, onDone })` ; `MonthView({ month, cal, input, onPick })` ; `WeekView({ monday, cal, input, onPick })` ; `DaySheet({ day, input, onClose })`.

- [ ] **Step 1: Write the failing tests** (`CalendarPage.test.tsx`, avec `WithUser`, Dexie remise à zéro, `vi.setSystemTime(new Date(2026, 9, 21, 10))`)

```ts
test('sans réglage : choix des jours, Valider désactivé tant que rien n’est coché', async () => {
  // « Quels jours tu t'entraînes ? » ; Valider disabled ; cocher Lundi + Mercredi → Valider → la grille apparaît
})
test('vue mois : pastilles et progression de la semaine', async () => {
  // réglage lun/mer/ven, séance faite lun 19 → bouton du 19 a l'étiquette accessible « 19 octobre, fait » ; le 21 « prévu » ; ligne de la semaine affiche « 1/3 »
})
test('bascule Semaine : 7 lignes avec la séance prévue et « Objectif : 1/3 séances »', async () => {})
test('détail d’un jour prévu futur : Déplacer puis Annuler le report', async () => {
  // toucher le 23 → « Déplacer » → choisir le 24 → le 23 devient « reporté » ; ouvrir le 23 → « Annuler le report » → redevient « prévu »
})
test('détail d’un jour de repos futur : Ajouter une séance ce jour', async () => {})
test('objectif modifiable depuis la vue semaine (−, +, Par défaut)', async () => {})
test('‹ › changent de mois ; « Aujourd’hui » revient au mois courant', async () => {})
```

- [ ] **Step 2: Run** — `npx vitest run src/features/calendar` → FAIL.

- [ ] **Step 3: Implement**

`CalendarPage` : `useLive(() => loadCalendarInput(userId, toISODate(new Date())))` ; `null` → `WeekdaysSetup`. État local : mode (`'month' | 'week'`, mémorisé dans `localStorage` `vytrano.calendar.view`, lecture/écriture sous try/catch), date affichée, jour sélectionné. En-tête : titre (« octobre 2026 » ou « 19 – 25 oct. »), ‹ ›, « Aujourd'hui », segmented « Mois / Semaine », bouton ⚙︎ (`aria-label="Jours d'entraînement"`) qui rouvre `WeekdaysSetup`. `MonthView` : 7 colonnes L M M J V S D + colonne progression, cellules boutons avec `aria-label` « {jour} {mois}, {état} » (états : fait, prévu, repos, manqué, reporté), classe `cal-{state}`, `today` entouré ; jours hors du mois atténués. `WeekView` : 7 lignes (date, pastille, nom de séance ou « Séance libre » / « Repos », exercices du jour en petit) ; en-tête « Objectif : x/y séances » qui ouvre un mini-éditeur −/+/« Par défaut » (`setWeeklyGoal`). `DaySheet` : contenu selon l'état (spec §6) ; « Déplacer » affiche les 14 prochains jours (≥ aujourd'hui, ≠ jour, non faits) comme boutons ; « Commencer » appelle `startWorkout(userId, day)` puis `navigate('/')`. Styles : `.cal-grid`, `.cal-cell`, pastilles par état avec les couleurs existantes (`--accent` pour fait) + variables ajoutées pour bleu / rouge / orange en clair et sombre.

- [ ] **Step 4: Run** — `npx vitest run src/features/calendar` → PASS ; `npm run build` → OK.

- [ ] **Step 5: Commit** — `git add src && git commit -m "feat(calendrier): onglet Calendrier, vues mois et semaine, détail d'un jour"`

### Task 4: Écran Séance — jour de repos

**Files:**
- Modify: `src/features/session/SessionPage.tsx`
- Test: `src/features/session/SessionPage.test.tsx` (créer)

**Interfaces:**
- Consumes: `loadCalendarInput`, `buildCalendar`, `toISODate`.

- [ ] **Step 1: Failing test** — avec un réglage lun/mer/ven et `today` mardi : « Jour de repos aujourd'hui » visible et « Commencer » toujours présent ; mercredi : texte absent ; sans réglage : texte absent.
- [ ] **Step 2: Run** — FAIL.
- [ ] **Step 3: Implement** — dans `NextWorkout`, calculer l'état d'aujourd'hui (`buildCalendar(input, today, today)[0].state === 'rest'`) et afficher `<p className="muted">Jour de repos aujourd'hui</p>` au-dessus de la liste.
- [ ] **Step 4: Run** — `npx vitest run` (toute la suite) → PASS ; `npm run build` → OK.
- [ ] **Step 5: Commit** — `git commit -am "feat(calendrier): indication jour de repos sur l'écran Séance"`

### Task 5: Vérification navigateur et docs

- [ ] **Step 1:** `docs/SETUP.md` : mentionner 006 dans la liste des scripts.
- [ ] **Step 2:** Aperçu `muscu-apercu` à 375 px avec session factice : réglage des jours, mois, semaine, déplacer puis annuler, terminer une séance → le jour passe en vert et la progression augmente ; mode sombre lisible.
- [ ] **Step 3: Commit** — `git commit -am "docs: script 006 du calendrier"`
