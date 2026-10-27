# Paramètres Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Page « Paramètres » (⚙️ dans l'en-tête) regroupant tous les réglages par catégories, avec recherche et choix du thème ; Profil allégé.

**Architecture :**
- Catalogue pur `src/features/settings/catalog.ts` (catégories, réglages, mots-clés, recherche).
- Thème `src/app/theme.ts` (lecture, application, enregistrement) + script inline dans `index.html` + CSS `data-theme`.
- Écran `src/features/settings/SettingsPage.tsx` (`/parametres`) qui affiche chaque réglage par son id, en réutilisant la logique existante découpée en petits composants.

**Tech Stack:** React 18, TypeScript, Vitest.

**Spec:** `docs/superpowers/specs/2026-10-27-parametres-design.md`

## Global Constraints

- Catégories et ordre : Apparence, Notifications, Confidentialité, Préférences d'entraînement, Compte.
- Libellés : « Paramètres », « Rechercher un paramètre », « Aucun paramètre trouvé », « Thème », « Système », « Clair », « Sombre » ; les autres réglages gardent leurs libellés actuels.
- Recherche insensible aux accents et aux majuscules (NFD), sur le nom et les mots-clés (table §3 de la spec).
- Thème : `localStorage` `vytrano.theme` (`system` | `light` | `dark`), `data-theme` sur `<html>` (absent pour `system`), `meta[name=theme-color]` `#f4f3ef` / `#111315`.
- Aucune migration, rien côté serveur.

## Review Focus

- Stockage indisponible (navigation privée) : la page s'ouvre, le thème suit le système, aucune erreur.
- Recherche avec espaces autour ou en majuscules accentuées (« ÉCRAN ») : trouve « Garder l'écran allumé ».
- Thème « Clair » sur un téléphone en mode sombre : toutes les couleurs claires (y compris calendrier, règles, macros).
- Partage de la progression désactivé depuis Paramètres : la carte vue par les amis est retirée comme avant.
- Profil : plus aucun réglage en double (Repos, Paramètres, interrupteur de partage de progression).

---

### Task 1: Catalogue et recherche

**Files :** Create `src/features/settings/catalog.ts` (+ `catalog.test.ts`)

```ts
export type CategoryId = 'appearance' | 'notifications' | 'privacy' | 'training' | 'account'
export const CATEGORIES: { id: CategoryId; label: string }[]
export type SettingId = 'theme' | 'restAlerts' | 'sound' | 'vibrate' | 'shareWorkouts' | 'shareProgress'
  | 'unit' | 'auto' | 'wakeLock' | 'username' | 'signOut' | 'deleteAccount'
export const SETTINGS: { id: SettingId; category: CategoryId; label: string; keywords: string[] }[]
export function normalize(s: string): string
export function searchSettings(query: string): SettingId[]   // dans l'ordre du catalogue ; requête vide → tous
```

- [ ] Tests : `normalize('  ÉCRAN ')` → `'ecran'` ; « vib » → `['vibrate']` ; « sombre » → `['theme']` ; « kilo » → `['unit']` ; « amis » → `['shareWorkouts', 'shareProgress']` ; « zzz » → `[]` ; « » → 12 ids.
- [ ] FAIL → implémenter → PASS → commit.

### Task 2: Thème

**Files :** Create `src/app/theme.ts` (+ test), `src/features/settings/ThemeSetting.tsx` ; Modify `index.html`, `src/app/styles.css`, `src/main.tsx` (appliquer au démarrage)

```ts
export type Theme = 'system' | 'light' | 'dark'
export function readTheme(): Theme            // 'system' si absent, invalide ou stockage indisponible
export function applyTheme(t: Theme): void    // data-theme + meta theme-color (system : selon matchMedia)
export function saveTheme(t: Theme): void     // enregistre (try/catch) puis applique
```

- CSS : chaque `@media (prefers-color-scheme: dark) { :root {…} }` (4 blocs) devient `:root:not([data-theme="light"])` dans le media, et le même contenu est repris pour `:root[data-theme="dark"]`.
- `index.html` : script inline avant le module, qui lit `vytrano.theme` (try/catch) et pose `data-theme`.
- `ThemeSetting` : groupe « Thème » à trois boutons `aria-pressed` (classe `segmented`).

- [ ] Tests : défaut `system` sans attribut ; `saveTheme('dark')` → `data-theme="dark"`, relu par `readTheme` ; `'system'` retire l'attribut ; valeur invalide → `system` ; `localStorage` qui lève → `system` sans erreur ; `ThemeSetting` : cliquer « Sombre » → `aria-pressed` et attribut.
- [ ] FAIL → implémenter → PASS → commit.

### Task 3: Page Paramètres et Profil allégé

**Files :** Create `src/features/settings/SettingsPage.tsx` (+ test), `src/features/settings/AccountSettings.tsx`, `src/features/settings/PrivacySettings.tsx` ; Modify `App.tsx` (route, lien ⚙️), `ProfilePage.tsx`, `ProgressCard.tsx`, `RestSettingsSection.tsx` (exporte `RestSwitch`), `styles.css` ; Delete `SettingsSection.tsx` (tests déplacés)

- `SettingsPage` : `h1` « Paramètres », `input type="search"` (`aria-label` « Rechercher un paramètre »), sections `aria-label` = nom de catégorie (masquées si aucun réglage visible), rendu de chaque `SettingId` visible ; « Aucun paramètre trouvé ».
- Composants par réglage, logique inchangée : `RestAlerts` ; `RestSwitch` (`sound`, `vibrate`, `auto`, `wakeLock`) ; `PrivacySettings` (partage des séances via `updateProfile`, partage de la progression via `setShareProgress` avec `loadProgress`) ; unité ; `AccountSettings` (pseudo, déconnexion avec confirmation si `pending`, suppression avec double confirmation).
- En-tête : `<Link to="/parametres" aria-label="Paramètres">⚙️</Link>` avant « Profil ».
- Profil : retire `RestSettingsSection`, `SettingsSection` ; `ProgressCard` perd l'interrupteur (garde la republication).

- [ ] Tests : 5 catégories ; « sombre » → seule Apparence ; « vib » → Vibration seule ; « zzz » → « Aucun paramètre trouvé » ; lien ⚙️ mène à la page ; tests de partage (séances, progression), suppression, interrupteurs de repos repris depuis la page ; Profil sans « Repos », « Paramètres » ni interrupteur de progression.
- [ ] FAIL → implémenter → PASS → build → commit.

### Task 4: Vérification

- [ ] Navigateur à 375 px, clair et sombre (thème forcé dans les deux sens).
