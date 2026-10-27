# Profil simplifié et historique — Design

Date : 2026-10-27

Suite des Paramètres (les réglages ont quitté le Profil).

## 1. Objectif

Un Profil centré sur la personne, ses objectifs et ses statistiques ; la liste des séances part dans
une page « Mon historique ». Rien de nouveau côté serveur.

## 2. Décisions validées

- Bouton vers une nouvelle page « Mon historique » (`/historique`), séances groupées par mois.
- Nouvelle carte « Mes stats » : séances, temps, charge totale, depuis le début.

## 3. Profil (`ProfilePage`)

Ordre : pseudo ; carte Régularité ; carte « Mes stats » ; deux boutons côte à côte
« 📅 Mon historique » (`/historique`) et « 🏆 Mes records » (`/records`) ; Mes besoins ; Poids.
La section « Mes séances » et son détail quittent le Profil.

## 4. « Mes stats » (`src/domain/stats.ts`, pur)

`globalStats(workouts, sets): { sessions: number; minutes: number; tonnageKg: number }`
- `sessions` : séances terminées (allégées comprises, comme l'XP).
- `minutes` : somme de `finished_at − started_at` des séances terminées, arrondie à la minute.
- `tonnageKg` : somme `weight × reps` des séries validées (`done`), de toute sorte sauf `warmup`,
  avec charge > 0 et reps > 0, dans les séances terminées.

Affichage (carte `aria-label="Mes stats"`) :
- « 87 séances » (« 1 séance », « 0 séance ») ;
- temps : « 45 min » sous une heure, sinon heures entières arrondies à l'inférieur : « 64 h » ;
- charge : kg → « 850 kg » sous 1 000 kg, sinon tonnes à une décimale « 182,5 t » ; lb → « 27 300 lb »
  (arrondi à l'entier, séparateur de milliers).

## 5. « Mon historique » (`/historique`, `src/features/history/HistoryPage.tsx`)

- Lien « ‹ Profil » puis titre « Mon historique ».
- Toutes les séances terminées, de la plus récente à la plus ancienne (`finished_at`), groupées par
  mois de `workoutDate` : titre « Octobre 2026 · 12 séances ».
- Ligne inchangée : nom, date courte, « N exercices », « N min » ; toucher → feuille de détail
  (composant déplacé du Profil, inchangé).
- Nombre d'exercices calculé en une seule lecture des séries (`anyOf` des séances).
- Vide : « Aucune séance terminée pour l’instant. »

## 6. Tests

- `globalStats` : séances, minutes, échauffement / non validée / 0 kg exclus, aucune séance.
- Affichage : « 45 min », « 64 h », « 850 kg », « 182,5 t », lb.
- Historique : groupes par mois avec compte, ordre, détail ouvert, vide.
- Profil : plus de « Mes séances », boutons vers l'historique et les records.
- Navigateur à 375 px.
