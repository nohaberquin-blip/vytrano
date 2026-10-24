# Minuteur de repos et alertes push Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Minuteur de repos automatique (calcul intelligent, ±15/30 s, bip, vibration, écran allumé) et notifications push de fin de repos (téléphone verrouillé, montre).

**Architecture:**
- Calcul pur dans `src/domain/rest.ts`.
- État du minuteur dans `localStorage`, hook `useRestTimer` et barre `RestBar` dans `src/features/session/`.
- Réglages appareil dans `src/features/session/restSettings.ts`.
- Push :
  - abonnement dans `src/data/push.ts` ;
  - programmation au passage en arrière-plan ;
  - table `rest_alarms` vidée par une tâche `pg_cron`, qui appelle l'Edge Function `rest-alarms` (Deno, `web-push`) ;
  - le service worker importe `public/push-sw.js`.

**Tech Stack:** React 18, TypeScript, Dexie, Supabase (Postgres, pg_cron, pg_net, Edge Functions Deno), Web Push (VAPID), Workbox via vite-plugin-pwa.

**Spec:** `docs/superpowers/specs/2026-10-25-repos-minuteur-design.md`

## Global Constraints

- Valeurs du repos exactement celles du §2 de la spec.
- Libellés exacts :
  - barre : « −15 s », « +15 s », « +30 s », « Passer », « C'est reparti ! », « Fermer » ;
  - réglages : « Repos automatique », « Son », « Vibration », « Garder l'écran allumé », « Activer les alertes de repos ».
- `localStorage` toujours dans un try/catch.
- Aucune clé privée dans le dépôt :
  - la clé privée VAPID ne vit que dans les secrets de la fonction ;
  - la clé publique VAPID va dans `VITE_VAPID_PUBLIC_KEY` (variable de build) ;
  - la clé anon publiable peut figurer dans la migration 009.
- Les migrations 008 et 009 doivent être exécutées avant la publication.

## Review Focus

- Une fin de repos ne joue le bip qu'une fois, même après des rendus multiples ou un retour d'arrière-plan. Pas de bip si la fin date de plus de 3 s.
- Valider puis annuler très vite la même série : aucun minuteur fantôme.
- Repos repris depuis `localStorage` pour une autre séance que celle en cours : ignoré et effacé.
- Notification envoyée deux fois si le cron tourne pendant l'envoi : la suppression atomique (`delete … returning`) doit l'empêcher.
- iOS hors écran d'accueil : pas de plantage (`PushManager` ou `Notification` absents).

---

### Task 1: Calcul du repos

**Files:** Create `src/domain/rest.ts`, `src/domain/rest.test.ts` ; Modify `src/domain/types.ts` (`UserExercise.rest_seconds?: number | null`)

**Produces :**
```ts
export const ATTACHED_REST = { drop: 15, restpause: 20, cluster: 20 }
export function baseRest(targetReps: number | null): number            // 180 / 120 / 75 ; null → 120
export function restSeconds(set: WorkoutSet, next: WorkoutSet | undefined,
  fiche: Pick<UserExercise, 'rest_seconds' | 'target_reps' | 'current_weight'> | undefined): number | null
export function formatClock(seconds: number): string                     // 150 → '2:30', 5 → '0:05'
export function parseClock(text: string): number | null                  // '2:30' → 150, '90' → 90, '' → null, invalide → NaN
```

- [ ] Tests (valeurs de la spec §2) :
  - pas de série suivante → `null` ;
  - suivante en drop → 15, en reprise → 20 ;
  - échauffement → 60 ;
  - base 5 reps → 180, 8 → 120, 15 → 75, échec → 120, fiche à 150 → 150 ;
  - top-set → +30 ;
  - reps faites < cible → +30 ;
  - reps faites ≥ cible + 2 → −15 ;
  - fourchette 8–12 avec 13 reps faites → pas de −15, avec 14 → −15 ;
  - charge 90 % de 100 kg → +15 ;
  - plancher 15 et plafond 600 ;
  - `formatClock` et `parseClock`.
- [ ] FAIL → implémenter → PASS → commit `feat(repos): calcul du repos`.

### Task 2: Minuteur, barre, réglages appareil, fiche

**Files:**
- Create : `src/features/session/restSettings.ts`, `useRestTimer.ts`, `RestBar.tsx`, `RestBar.test.tsx`, `beep.ts`
- Modify : `SessionPage.tsx` (ActiveWorkout), `src/features/exercises/ExerciseSheet.tsx` (+ test), `src/features/profile/ProfilePage.tsx` (section « Repos »), `styles.css`
- SQL : `supabase/migrations/008_repos_push.sql`, avec seulement la colonne `rest_seconds` à ce stade (les tables push sont ajoutées en Task 3, dans le même fichier)

**Produces :**
```ts
// restSettings.ts
export interface RestSettings { auto: boolean; sound: boolean; vibrate: boolean; wakeLock: boolean }
export function readRestSettings(): RestSettings; export function writeRestSettings(s: RestSettings): void
export function useRestSettings(): [RestSettings, (s: RestSettings) => void]
// useRestTimer.ts
export interface RestState { workoutId: string; setId: string; endsAt: number; total: number; next: string }
export function readRest(): RestState | null; export function writeRest(r: RestState | null): void
export function useRestTimer(workoutId: string): {
  rest: RestState | null; remaining: number /* s, négatif = dépassement */;
  start(r: Omit<RestState, 'workoutId'>): void; adjust(delta: number): void; stop(): void }
// beep.ts
export function unlockAudio(): void; export function playBeeps(): void
```

- [ ] Tests (`RestBar.test.tsx`, faux minuteurs `vi.useFakeTimers()`) :
  - **Démarrage** : `start` à 90 s → « 1:30 ».
  - **Ajustements** : +30 s → « 2:00 » ; −15 s → « 1:45 ».
  - **Fin** : avancer de 106 s → « C'est reparti ! », `playBeeps` et `navigator.vibrate` appelés **une fois** ; avancer encore de 12 s → « +0:12 ».
  - **Passer** efface l'état.
  - **Reprise** : un état valide dans `localStorage` est repris ; un état d'une autre séance est ignoré et effacé.
  - **Réglages** : son désactivé → pas de bip ; fin vieille de plus de 3 s au montage → pas de bip.
- [ ] Tests d'intégration : ajouter dans `SessionPage.test.tsx` un cas « valider une série démarre le repos ; annuler l'arrête ».
- [ ] Test de `ExerciseSheet` :
  - « Repos de base » à `2:30` → `save` reçoit `rest_seconds: 150` ;
  - vide → `null` ;
  - `5` → erreur « Repos : 0:10 à 10:00 ».
- [ ] Implémenter :
  - ActiveWorkout calcule `next` et le libellé « Exercice · série n · charge × reps » ;
  - `onUpdate` démarre le repos quand une série passe de non validée à validée, si `auto` est activé ;
  - annuler la validation de la série en cours arrête le repos ;
  - terminer ou abandonner la séance arrête le repos ;
  - Wake Lock tant que la séance est affichée, si le réglage l'autorise ;
  - `RestBar` est fixée au-dessus de la tabbar.
- [ ] Section « Repos » du Profil : 4 interrupteurs (Task 3 y ajoutera le bouton d'alertes).
- [ ] Migration 008 (colonne) + `rls_check` (contrainte `rest_seconds` 5 refusée).
- [ ] PASS + build → commit `feat(repos): minuteur, barre de repos et réglages`.

### Task 3: Notifications push

**Files:**
- Create : `public/push-sw.js`, `src/data/push.ts`, `src/data/push.test.ts`, `src/features/profile/RestAlerts.tsx` (+ test), `supabase/functions/rest-alarms/index.ts`, `supabase/migrations/009_repos_cron.sql`
- Modify : `vite.config.ts` (`workbox.importScripts: ['push-sw.js']`), `008_repos_push.sql` (tables), `rls_check.sql`, `setup_all.sql` (001→008 ; 009 à part), `useRestTimer.ts` ou `SessionPage.tsx` (programmation), `docs/SETUP.md`

**Produces (`push.ts`) :**
```ts
export type PushSupport = 'ok' | 'ios-home-screen' | 'unsupported'
export function pushSupport(): PushSupport
export async function enablePush(userId: string): Promise<'enabled' | 'denied' | 'error'>
export async function disablePush(): Promise<void>
export async function isPushEnabled(): Promise<boolean>
export function scheduleRestAlarm(userId: string, fireAt: number, body: string): void   // fetch keepalive, upsert
export function cancelRestAlarm(userId: string): void                                   // fetch keepalive, delete
```

- [ ] Tests `push.test.ts` (fetch simulé) :
  - `scheduleRestAlarm` → POST `/rest/v1/rest_alarms` avec `Prefer: resolution=merge-duplicates`, `keepalive: true`, corps `{user_id, fire_at ISO, title:'Repos terminé', body}` ;
  - `cancelRestAlarm` → DELETE `?user_id=eq.u` ;
  - `pushSupport` : iOS sans `PushManager` → `'ios-home-screen'`.
- [ ] Test d'intégration dans `RestBar.test.tsx` : avec alertes activées et un repos en cours, l'événement `visibilitychange` (hidden) appelle `scheduleRestAlarm`, et (visible) appelle `cancelRestAlarm` ; sans alerte ou sans repos → aucun appel.
- [ ] Test `RestAlerts` : affiche le guide iPhone quand `pushSupport()` vaut `'ios-home-screen'`.
- [ ] Implémenter :
  - Edge Function : `delete … where fire_at <= now() returning *` (via RPC SQL `take_due_rest_alarms()` en security definer, réservée à `service_role`) ; `web-push` sur chaque abonnement ; suppression des abonnements en 404 / 410 ;
  - 009 : `cron.schedule('rest-alarms', '5 seconds', …)` avec un `net.http_post` vers `https://kkusotincuwjjokyyfjl.supabase.co/functions/v1/rest-alarms`, seulement s'il existe une alarme due.
- [ ] `rls_check` :
  - B ne voit ni les abonnements ni les alarmes de A ;
  - `take_due_rest_alarms` est interdite à `authenticated`.
- [ ] PASS + build → commit `feat(repos): alertes push de fin de repos`.

### Task 4: Mise en place serveur et vérification

- [ ] Générer les clés VAPID (`npx web-push generate-vapid-keys --json`), sans jamais afficher la clé privée. La clé publique va dans `.env.local` et dans la commande de build Vercel.
- [ ] Une fois que l'utilisateur a fait `npx supabase login` :
  - `npx supabase secrets set VAPID_PUBLIC_KEY=… VAPID_PRIVATE_KEY=… VAPID_SUBJECT=mailto:…` ;
  - `npx supabase functions deploy rest-alarms --no-verify-jwt --project-ref kkusotincuwjjokyyfjl`.
- [ ] Navigateur à 375 px :
  - valider une série → barre ;
  - +30 s, −15 s, fin → « C'est reparti ! » ;
  - réglages du Profil.
- [ ] `docs/SETUP.md` : extensions, 008, 009, secrets, déploiement de la fonction.
