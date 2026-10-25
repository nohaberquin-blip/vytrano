# Records et progression — Design

Date : 2026-10-25

Étape B de la motivation (A : régularité, faite ; C : le mois ; D : rappels).

## 1. Objectif

Détecter les records de chaque exercice (charge max et 1RM estimé), les célébrer pendant et après
la séance, et montrer la progression : courbe dans la fiche de l'exercice et page « Mes records ».
Rien de nouveau sur le serveur (tout est calculé depuis l'historique), rien n'est partagé, pas d'XP.

## 2. Décisions validées

- Records : charge max + 1RM estimé (Epley).
- Célébration immédiate sur la série + récapitulatif en fin de séance + page « Mes records ».
- Courbe : sélecteur « 1RM estimé / Charge max » (1RM par défaut), période « 3 mois / 1 an / Tout ».

## 3. Calcul (`src/domain/records.ts`, pur)

- **1RM estimé** d'une série : `reps === 1 ? charge : charge × (1 + reps / 30)`, arrondi à 0,5 kg.
- **Séries prises en compte** : validées (`done`), d'un type qui compte (`COUNTING_KINDS`), charge > 0,
  reps > 0, dans une séance terminée ou en cours **non allégée**. Échauffements, séries rattachées
  (drop, reprise) et séances allégées ignorés.
- **Ordre** : séances par date de début, puis séries par position.
- **Record** : une série bat strictement le meilleur résultat précédent (séances précédentes et séries
  précédentes de la même séance) pour la charge max et/ou le 1RM estimé. La toute première séance
  d'un exercice ne produit aucun record (référence vide).
- API :
  - `oneRepMax(set): number`
  - `exerciseRecords(history): { best: { weight: Best | null; e1rm: Best | null }; points: Point[] }` où
    `Best = { value, date }`, `Point = { date, e1rm, weight, record: boolean }` (un point par séance :
    meilleures valeurs de la séance ; `record` si la séance a battu au moins un record) ;
  - `setRecords(previous: WorkoutSet[], session: WorkoutSet[]): Map<setId, ('weight' | 'e1rm')[]>`
    (records de la séance en cours, série par série).

## 4. Pendant la séance (`ExerciseCard`)

- Sous une série record validée : « 🏆 Record ! Charge max 100 kg » / « 🏆 Record ! 1RM estimé 113 kg »
  (les deux si les deux).
- À la validation d'une série qui devient record : `navigator.vibrate([60, 40, 60])` si la vibration
  est activée (réglages de repos), une seule fois par série.
- Dévalider la série retire la mention.

## 5. Fin de séance

Le bandeau ajoute « 🏆 2 records : Squat (charge max 100 kg), Développé couché (1RM estimé 85 kg) »
(par exercice, le ou les records battus, avec la meilleure valeur de la séance). Pas d'XP.

## 6. Fiche d'un exercice (`ExerciseSheet`)

- Section « Records » : « Charge max 100 kg · 3 sept. 2026 », « 1RM estimé 113 kg · 3 sept. 2026 » ;
  rien si aucune série prise en compte.
- Courbe (`ProgressChart`, même style que la courbe de poids) :
  - sélecteurs « 1RM estimé / Charge max » et « 3 mois / 1 an / Tout » (`aria-pressed`) ;
  - un point par séance, points des séances records en couleur d'accent ;
  - moins de 2 séances sur la période : « Fais encore une séance pour voir ta courbe ».
- « Dernières séances » inchangé, en dessous.

## 7. « Mes records » (`/records`)

- Lien « 🏆 Mes records » dans le Profil (sous la carte Régularité).
- Liste des exercices ayant au moins une série prise en compte, triés par date du dernier record
  (le plus récent en haut) : nom, « Charge max 100 kg · 1RM estimé 113 kg », date du dernier record.
- Toucher un exercice ouvre sa fiche (avec la courbe).
- Vide : « Termine une séance pour voir tes records. »

## 8. Tests

- `oneRepMax` (1 rep, 8 reps, arrondi) ; séries ignorées (échauffement, drop, non validée, 0 kg,
  séance allégée) ; première séance sans record ; record battu à la séance suivante ; deux records
  dans la même séance (série 2 bat série 1) ; égalité = pas de record ; points par séance.
- Écrans : mention « 🏆 Record ! » à la validation et vibration ; dévalider la retire ; bandeau de
  fin ; fiche (records, courbe, sélecteurs, message < 2 séances) ; page « Mes records » (tri, vide,
  ouverture de la fiche).
- Navigateur à 375 px.
