# Fiche personnelle, besoins et suivi du poids Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Dans l'onglet Profil : une fiche privée (sexe, naissance, taille, activité, séances, objectif), des pesées avec courbe, et une carte « Mes besoins » (kcal, protéines, glucides, lipides, IMC) réglable.

**Architecture:** Deux tables synchronisées comme le calendrier (`body_profiles`, `weight_entries`). Tous les calculs sont des fonctions pures dans `src/domain/needs.ts`. L'UI est faite de trois composants dans `src/features/profile/` (NeedsCard, WeightCard, BodySheet), insérés en haut de ProfilePage. La courbe est en SVG fait main.

**Tech Stack:** React 18, TypeScript, Dexie 4, Supabase, Vitest + Testing Library.

**Spec:** `docs/superpowers/specs/2026-10-25-fiche-besoins-poids-design.md`

## Global Constraints

- Stockage en kg et en cm ; affichage du poids via `useUnit` (`show`, `toDisplay`, `toKg`).
- Facteurs, g/kg, bornes et arrondis : exactement ceux des §2 et §3 de la spec.
- Les infos ne sont jamais lisibles par un autre utilisateur (RLS).
- Les ids sont fixes : `body_profiles.id = user_id` ; `weight_entries.id = stableId(user, 'weight', date)` (depuis `src/data/calendar.ts`).
- Les inputs font au moins 16 px ; la page tient à 375 px ; le thème sombre est lisible.
- Le script 007 doit être collé dans Supabase avant la publication.

## Review Focus

- Saisie en lb : la borne 30–300 kg est vérifiée après conversion ; l'affichage de l'écart et de la courbe est en lb.
- Une fiche partielle ne doit jamais afficher NaN ni « undefined » : chaque bloc est calculé seulement si ses entrées existent.
- Changer de période ou ajouter une pesée met la courbe à jour sans plantage, avec 0, 1 ou 2 pesées (axes à étendue nulle).
- La date d'une pesée suit le jour local, pas le jour UTC (pas de décalage la nuit).
- Le pull convertit `numeric` (chaîne) en nombre pour `height_cm`, `protein_per_kg` et `weight_kg`.

---

### Task 1: Calculs (domaine pur)

**Files:** Modify `src/domain/types.ts` ; Create `src/domain/needs.ts` ; Test `src/domain/needs.test.ts`

**Interfaces — Produces :**
```ts
// types.ts
export type Sex = 'male' | 'female' | 'unspecified'
export type Activity = 'sedentary' | 'light' | 'active' | 'very_active'
export type Goal = 'bulk' | 'cut' | 'maintain' | 'recomp' | 'strength'
export interface BodyProfile { id: string; user_id: string; sex: Sex | null; birth_date: string | null; height_cm: number | null;
  activity: Activity | null; sessions_per_week: number | null; goal: Goal | null;
  kcal_override: number | null; protein_per_kg: number | null; fat_pct: number | null; updated_at?: string }
export interface WeightEntry { id: string; user_id: string; date: string; weight_kg: number; updated_at?: string }
// needs.ts
export const ACTIVITY_FACTORS: Record<Activity, number>      // 1.2 / 1.3 / 1.4 / 1.5
export const GOALS: Record<Goal, { label: string; kcal: number; proteinPerKg: number }>
export const ACTIVITY_LABELS, SEX_LABELS
export function ageOn(birth: string, today: string): number
export function bmi(weightKg: number, heightCm: number): number            // 1 décimale
export function bmiCategory(b: number): 'Maigreur' | 'Normal' | 'Surpoids' | 'Obésité'
export interface Needs {
  missing: string[]                 // libellés : 'ta pesée', 'ta taille', 'ta date de naissance', 'ton sexe', 'ton activité', 'tes séances par semaine', 'ton objectif'
  bmi: number | null; bmr: number | null; maintenance: number | null
  kcal: number | null; protein: number | null; fat: number | null; carbs: number | null
  carbsExhausted: boolean
  custom: { kcal: boolean; protein: boolean; fat: boolean }
}
export function computeNeeds(p: BodyProfile | null, weightKg: number | null, today: string): Needs
export function rollingAverage(entries: WeightEntry[]): { date: string; avg: number }[]   // triées par date ; fenêtre 7 jours (date-6 … date)
```

- [ ] **Step 1: Write the failing tests**

Écrire ces cas :
- **Homme**, 30 ans le jour J, 180 cm, 75 kg, sédentaire, 4 séances, sèche → bmr 1730, maintenance 2422, kcal 1940, protein 165, fat 54, carbs 199, bmi 23.1.
- **Femme**, 25 ans, 165 cm, 60 kg, peu active, 3 séances, maintien → bmr 1345, kcal 1950, protein 96, fat 54, carbs 270.
- **« Ne pas préciser »**, mêmes valeurs que l'homme → bmr 1647.
- **IMC > 30** : 180 cm, 110 kg, sèche → la référence est 81 kg, donc protein 178 (2.2 × 81) ; bmiCategory 'Obésité'.
- **Minimum de lipides** : `fat_pct` 15 et kcal_override 1200 à 75 kg → fat 45 (0.6 × 75).
- **Glucides épuisés** : kcal_override 1200, protein_per_kg 3.0, 75 kg → carbs 0, carbsExhausted true.
- **Réglages perso** : kcal_override 2500 → kcal 2500, custom.kcal true ; changer fat_pct recalcule les glucides et garde le total.
- **Fiche manquante** : profil null et pas de poids → tout null ; missing contient 'ta pesée'. Avec seulement le poids et la taille → bmi seul. Avec kcal_override + poids sans objectif → macros calculées avec 1.6 g/kg.
- **Âge** : ageOn('1996-10-25', '2026-10-24') = 29 ; le '2026-10-25' = 30.
- **rollingAverage** : pesées 80, 79 et 78 aux jours 1, 2 et 10 → moyennes 80, 79.5 et 78 (le jour 10 est hors fenêtre des deux autres).

- [ ] **Step 2:** `npx vitest run src/domain/needs.test.ts` → FAIL.
- [ ] **Step 3:** Implémenter selon la spec §3. Arrondis : bmr et maintenance à l'unité, kcal à 10 kcal près, grammes à l'unité ; les glucides se calculent à partir des grammes de protéines et de lipides déjà arrondis.
- [ ] **Step 4:** Relancer → PASS.
- [ ] **Step 5:** Commit `feat(profil): calculs des besoins et de l'IMC`.

### Task 2: Données — migration 007, tables locales, actions

**Files:**
- Create : `supabase/migrations/007_fiche_poids.sql` ; `src/data/body.ts` ; `src/data/body.test.ts`
- Régénérer : `supabase/setup_all.sql` (… 006, 007)
- Modify : `supabase/tests/rls_check.sql`, `src/data/db.ts` (version 5 ; tables `body_profiles: 'id, user_id'`, `weight_entries: 'id, user_id, date'`), `src/data/repo.ts` (PULL_ORDER, OWNER_COL, NUMERIC), `src/data/repo.test.ts`

**Interfaces — Produces (`body.ts`) :**
```ts
export const getBodyProfile = (userId: string) => Promise<BodyProfile | undefined>
export async function saveBodyProfile(userId: string, changes: Partial<Omit<BodyProfile, 'id' | 'user_id'>>): Promise<void>  // fusionne avec l'existant, champs absents = null
export async function addWeight(userId: string, date: string, weightKg: number): Promise<void>  // id fixe → remplace le même jour
export async function removeWeight(id: string): Promise<void>
export async function listWeights(userId: string): Promise<WeightEntry[]>   // triées par date croissante
export async function latestWeight(userId: string): Promise<WeightEntry | undefined>
```

- [ ] **Step 1: Migration 007.** Créer les deux tables de la spec §2 avec leurs checks, `unique (user_id, date)` sur les pesées, RLS « for all using/with check user_id = auth.uid() », et `on delete cascade` vers `auth.users`.
- [ ] **Step 2: rls_check.** Avant « Suppression du compte de A » :
  - en postgres, une fiche et une pesée pour A ;
  - en B, la fiche et la pesée de A sont invisibles, et une insertion pour A échoue en `insufficient_privilege` ;
  - contraintes refusées : taille 300, poids 20, `fat_pct` 50.
- [ ] **Step 3: Failing tests.**
  - `body.test.ts` : saveBodyProfile crée puis fusionne ; addWeight deux fois le même jour donne 1 ligne avec la dernière valeur ; removeWeight ; latestWeight renvoie la date la plus récente ; les données d'un autre utilisateur sont ignorées.
  - `repo.test.ts` : un pull avec les chaînes `'180.0'`, `'2.2'` et `'75.40'` les convertit en nombres.
- [ ] **Step 4:** `npx vitest run src/data` → FAIL. **Step 5:** implémenter. **Step 6:** PASS. **Step 7:** commit `feat(profil): fiche et pesées privées, synchronisées`.

### Task 3: Cartes « Mes besoins », « Ajuster », « Ma fiche »

**Files:** Create `src/features/profile/NeedsCard.tsx`, `BodySheet.tsx`, `AdjustSheet.tsx`, `NeedsCard.test.tsx` ; Modify `ProfilePage.tsx`, `styles.css`

**Interfaces — Consumes :** `computeNeeds`, `GOALS`, labels (Task 1) ; `getBodyProfile`, `saveBodyProfile`, `latestWeight` (Task 2) ; `getSchedule` (calendrier) pour pré-remplir les séances.

- [ ] **Step 1: Failing tests (`NeedsCard.test.tsx`)**
  - **Fiche complète + pesée** : « 1 940 kcal », « Protéines 165 g », « Glucides 199 g », « Lipides 54 g », « IMC 23,1 (normal) », « Repères moyens, pas un avis médical. ».
  - **Fiche vide** : « Complète ta fiche pour voir tes besoins » et la liste des manques ; le bouton « Ma fiche » ouvre le panneau.
  - **Ma fiche** :
    - date de naissance qui donne 10 ans → « Âge : 13 à 100 ans » et « Enregistrer » désactivé ;
    - séances pré-remplies avec 3 si le calendrier a 3 jours cochés ;
    - Enregistrer → la fiche est écrite.
  - **Ajuster** :
    - calories 2500 → glucides recalculés en direct ;
    - Enregistrer → la carte affiche « 2 500 kcal (perso) » ;
    - « Revenir aux valeurs conseillées » → « 1 940 kcal ».
  - **Glucides épuisés** : « 0 g de glucides : baisse les protéines ou les lipides ».
- [ ] **Step 2:** FAIL. **Step 3:** implémenter.
  - Carte : barre de macros en 3 segments à largeurs proportionnelles aux kcal.
  - Ma fiche :
    - sexe et objectif en `select` ;
    - activité en 4 boutons radio avec description ;
    - taille et séances en champs numériques (`inputMode`) ;
    - date de naissance en `<input type="date">`.
  - Ajuster : champs Calories (vide = Auto), Protéines g/kg, Lipides %, aperçu des glucides.
  - Bornes de la spec, avec messages d'erreur.
- [ ] **Step 4:** `npx vitest run src/features/profile` → PASS ; build OK. **Step 5:** commit `feat(profil): carte Mes besoins, Ma fiche et Ajuster`.

### Task 4: Carte « Mon poids » et courbe

**Files:** Create `src/features/profile/WeightCard.tsx`, `WeightChart.tsx`, `WeightCard.test.tsx` ; Modify `ProfilePage.tsx`, `styles.css`

**Interfaces — Consumes :** `addWeight`, `removeWeight`, `listWeights` ; `rollingAverage` ; `useUnit` ; `toISODate`, `addDays` (calendar.ts).

- [ ] **Step 1: Failing tests (`WeightCard.test.tsx`)**
  - **Sans pesée** : « Ajoute ta première pesée ».
  - **Ajout** : « ＋ Pesée », 75,4, Enregistrer → « 75,4 kg » affiché.
  - **Écart** : pesées à J-40 (77) et J (75,4) → « − 1,6 kg en 30 jours ». Avec seulement J-10 (76) et J (75,4) → « − 0,6 kg depuis le 14 oct. ».
  - **Saisie en lb** : profil en lb, saisie 166 → stocké 75.3 kg (arrondi à 0,01), affiché « 166 lb ».
  - **Bornes** : saisie 20 → « Poids : 30 à 300 kg » ; date future refusée.
  - **Historique** : supprimer une pesée → elle disparaît.
  - **Courbe** : `role="img"` avec le libellé « Courbe du poids » ; « 1 mois » change le nombre de points (`data-points`) ; 1 seule pesée → pas de plantage.
- [ ] **Step 2:** FAIL. **Step 3:** implémenter.
  - WeightChart :
    - SVG `viewBox 0 0 320 160` ;
    - Y = min/max des valeurs ± 1 kg (étendue nulle → ± 1) ;
    - X = dates de la période ;
    - points `circle`, moyenne `polyline` ;
    - 2 étiquettes Y (min, max) et 2 étiquettes X (début, fin).
  - Périodes : 30 / 90 / 365 jours / Tout ; 3 mois par défaut.
- [ ] **Step 4:** `npx vitest run` → PASS ; build OK. **Step 5:** commit `feat(profil): suivi du poids et courbe`.

### Task 5: Vérification navigateur et docs

- [ ] `docs/SETUP.md` : mentionner 007.
- [ ] Aperçu `muscu-apercu` à 375 px, avec une session factice :
  - remplir la fiche ;
  - ajouter 3 pesées ;
  - régler les besoins puis revenir aux valeurs conseillées ;
  - changer la période de la courbe ;
  - vérifier le mode sombre.
- [ ] Commit `docs: script 007`.
