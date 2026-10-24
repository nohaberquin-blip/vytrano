# Régularité Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Série de semaines avec jokers, XP et niveaux, badges, et résumé partageable avec les amis (désactivé par défaut).

**Architecture :**
- Calcul pur `progress()` dans `src/domain/streak.ts`, recalculé depuis l'historique (séances terminées + `CalendarInput`).
- `src/data/progress.ts` : `loadProgress(userId)`, carte partagée (`progress_cards`, écriture directe Supabase hors outbox), réglage `profiles.share_progress`.
- Écrans : carte « Régularité » du Profil, série sur Séance, bandeau de fin, résumé sur la page Amis.

**Tech Stack:** React 18, TypeScript, Dexie, Supabase, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-25-regularite-design.md`

## Global Constraints

- Valeurs exactes du §3 de la spec (100 XP / séance ; 200 × min(2, 1 + 0,1 × (série − 1)) ; palier `1500 + 250 × (n − 1)` ; jokers toutes les 4 semaines réussies, 2 au plus ; « Le retour » après 21 jours).
- Libellés : « Régularité », « Niveau N · Titre », « 🔥 N semaines de suite », « 🃏 N joker(s) », « Montrer mon niveau et mes badges à mes amis », « +N XP », « Niveau N atteint ! », « Nouveau badge : … ».
- Rien n'est envoyé au serveur tant que le partage est désactivé ; le désactiver supprime la carte.
- Le script 012 doit être exécuté avant la publication.

## Review Focus

- Calendrier jamais réglé : pas de série ni de bonus de semaine, mais l'XP des séances et les badges de séances marchent.
- Changer l'objectif d'une semaine passée recalcule tout (pas d'XP figée).
- Partage désactivé : aucune requête `progress_cards` ; activation puis désactivation : la carte disparaît pour les amis.
- Plusieurs séances le même jour : chacune rapporte 100 XP, mais la semaine compte des jours distincts (comme le Calendrier).
- Bandeau de fin : l'XP affichée correspond exactement à la différence avant / après.

---

### Task 1: Calcul (domaine)

**Files :** Create `src/domain/streak.ts`, `streak.test.ts`

```ts
export interface Badge { id: string; label: string; hint: string }   // catalogue BADGES (ordre d'affichage)
export const BADGES: Badge[]
export interface Progress {
  level: number; title: string; xp: number; xpInLevel: number; xpForNext: number
  streak: number; jokers: number; badges: { id: string; date: string }[]
}
export function xpForLevel(n: number): number            // XP totale pour atteindre le niveau n (1 → 0, 2 → 1500, 3 → 3250)
export function titleFor(level: number): string
export function progress(workouts: Workout[], input: CalendarInput | null, today: string): Progress
export function progressGain(before: Progress, after: Progress): { xp: number; level: number | null; badges: Badge[] }
```

- [ ] Tests :
  - niveaux : 0 → 1, 1 499 → 1, 1 500 → 2, 3 250 → 3 ; titres 1, 4, 5, 30 ;
  - sans calendrier : 3 séances → 300 XP, série 0, badge `sessions-1` daté de la 1re ;
  - 3 semaines réussies (objectif 3) → série 3, XP 9 × 100 + 200 + 220 + 240 ;
  - semaine ratée sans joker → série 0 ; 4 réussies puis 1 ratée → série 4, jokers 0 ; jokers plafonnés à 2 ;
  - objectif 0 : neutre ; semaine en cours non atteinte : neutre ; atteinte : comptée ; semaines avant `since` ignorées ;
  - bonus plafonné à 400 (11e semaine) ;
  - 2 séances le même jour : 200 XP, la semaine compte 1 jour ;
  - badges `streak-4`, `goal-1`, `goal-10`, `level-5`, `comeback` (21 jours, pas 20) avec leurs dates ;
  - `progressGain` : +XP, niveau atteint, nouveaux badges.
- [ ] FAIL → implémenter → PASS → commit.

### Task 2: Données et migration 012

**Files :** Create `supabase/migrations/012_regularite.sql`, `src/data/progress.ts` (+ test) ; Modify `src/domain/types.ts` (`Profile.share_progress`), `src/data/profile.ts` (select), `rls_check.sql`, `setup_all.sql`, `docs/SETUP.md`

```ts
export function loadProgress(userId: string, today: string): Promise<Progress>
export function cardOf(p: Progress): { level: number; title: string; streak: number; badges: string[] }
export async function publishCard(userId: string, p: Progress, client?): Promise<void>   // upsert progress_cards
export async function removeCard(userId: string, client?): Promise<void>
export async function setShareProgress(userId: string, on: boolean, p: Progress): Promise<void>  // profil + carte
export async function fetchFriendCards(ids: string[]): Promise<Map<string, FriendCard>>
```

- [ ] Tests (client Supabase simulé) : `setShareProgress(true)` écrit le profil puis la carte ; `false` supprime la carte ; `loadProgress` lit Dexie.
- [ ] SQL : `profiles.share_progress boolean not null default false` ; table `progress_cards` + `can_see_progress(owner)` (security definer, `owner = auth.uid() or is_friend(auth.uid(), owner)`), lecture par cette fonction, écriture par soi ; `rls_check` : B (ami) lit la carte de A, C non, B n'écrit pas celle de A.
- [ ] FAIL → implémenter → PASS → commit.

### Task 3: Écrans

**Files :** Create `src/features/profile/ProgressCard.tsx` (+ test) ; Modify `ProfilePage.tsx`, `SessionPage.tsx` (série + bandeau), `FriendsManager.tsx`, `styles.css`

- [ ] Tests :
  - Profil : « Niveau 1 · Débutant », barre `progressbar`, badges débloqués / grisés, « 🔥 » absent si série 0 ;
  - interrupteur : activé → `publishCard` appelé ; désactivé → `removeCard` ;
  - fin de séance : « +100 XP » et « Nouveau badge : 1re séance » ;
  - Séance : « 🔥 2 semaines » quand série 2 ;
  - Amis : « Niv. 4 · Débutant · 🔥 6 » pour un ami dont la carte existe.
- [ ] Après chaque séance terminée, si le partage est activé : `publishCard` (erreur ignorée).
- [ ] FAIL → implémenter → PASS → build → commit.

### Task 4: Vérification

- [ ] Navigateur à 375 px : carte du Profil, bandeau de fin.
- [ ] `SETUP.md` : 012.
