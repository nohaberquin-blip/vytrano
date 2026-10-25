# Le mois (objectif, défis, bilan) — Design

Date : 2026-10-25

Étape C de la motivation (A : régularité, B : records — faites ; D : rappels — plus tard).

## 1. Objectif

Un objectif de séances par mois, des défis personnels (séances ou charge, avec une date de fin) et un
bilan du mois, ouvert automatiquement au début du mois suivant et consultable depuis le Calendrier.
Rien n'est partagé ; pas d'XP pour les défis.

## 2. Décisions validées

- Objectif mensuel et défis réunis dans une même table ; deux types de défis : séances, charge.
- Bilan : ouverture automatique + bouton dans le Calendrier (mois passés et mois en cours).

## 3. Objectif du mois (`src/domain/month.ts`)

- Valeur proposée : nombre de jours du mois où `isPlanned(date, input)` est vrai (jours cochés,
  reports, jours ajoutés et jours passés en repos pris en compte). Sans calendrier réglé : pas d'objectif.
- Valeur modifiée : ligne `challenges` de type `month` (id `stableId('month', userId, 'YYYY-MM')`),
  0 à 62 ; « Par défaut » la supprime.
- Fait : séances terminées du mois (chaque séance compte, comme l'XP).

## 4. Défis (`src/domain/challenges.ts`)

| Type | Champs | Progression |
|---|---|---|
| `sessions` | `target` (1 à 200) | séances terminées entre `start` et `end` inclus |
| `lift` | `exercise_id`, `metric` (`weight` / `e1rm`), `target` (kg, 1 à 999) | meilleure valeur de la période, séries comptées comme les records (`counts`, séances non allégées) |

- `start` = jour de création ; `end` choisi (fin du mois par défaut, au plus 1 an après `start`,
  jamais avant `start`).
- Statut : `done` (date = jour où la cible est atteinte), `failed` (`end` < aujourd'hui sans l'avoir
  atteinte), `active` sinon.
- Liste « Mes défis » : actifs, puis terminés depuis moins de 30 jours ; les autres dans
  « Défis terminés » (repliable).
- `challengeProgress(c, workouts, setsByWorkout, lightened, today): { value, target, status, doneOn }`.

## 5. Bilan du mois (`monthReport`)

Pour un mois `YYYY-MM` :
- séances faites / objectif du mois (proposé ou modifié) ;
- semaines réussies dont le lundi tombe dans le mois, série à la fin du mois (calcul de la Régularité
  limité à cette date) ;
- records battus dans le mois (par exercice) ;
- défis réussis et échoués dont la date (réussite ou fin) tombe dans le mois ;
- XP gagnée dans le mois (XP au dernier jour − XP au dernier jour du mois précédent) et badges datés du mois ;
- différence de séances avec le mois précédent (« +2 séances », « −1 séance », « autant que »).

## 6. Écrans

- **Calendrier, vue Mois** :
  - en haut : « Objectif de novembre : 5 / 13 séances » + barre ; toucher → réglage (−, ＋, « Par défaut ») ;
  - bouton « Bilan du mois » (mois en cours et mois passés ; pas pour les mois futurs) ;
  - sous la grille : « Mes défis » (barre, « 12 / 20 séances » ou « 112,5 / 120 kg », ✅ réussi le…,
    échoué grisé, supprimer) et « ＋ Nouveau défi ».
- **Nouveau défi** (feuille) : type « Séances » / « Charge » ; pour Charge : exercice (parmi mes
  exercices), « Charge max » / « 1RM estimé », kg ; date de fin (fin du mois par défaut) ; erreurs
  « Entre 1 et 200 séances », « Entre 1 et 999 kg », « Date de fin invalide ».
- **Bilan** (feuille « Ton bilan d'octobre ») : les blocs du §5, chacun absent s'il est vide (sauf séances).
- **Ouverture automatique** : à l'ouverture de l'app, si le mois précédent n'a pas encore été montré
  sur cet appareil (`localStorage`) et qu'il compte au moins une séance.
- **Fin de séance** : « 🎯 Défi réussi : Squat à 120 kg » pour chaque défi passé à `done` par la séance.

## 7. Données (migration 013)

Table `challenges` : `id uuid pk`, `user_id` (RLS propriétaire), `kind text check in ('month','sessions','lift')`,
`exercise_id uuid null references exercises on delete cascade`, `metric text null check in ('weight','e1rm')`,
`target numeric(6,2) not null check (target between 0 and 999)`, `start date not null`, `end_date date not null
check (end_date >= start)`, `updated_at`. Dexie version 6 (`challenges: 'id, user_id, kind'`), synchronisée.

## 8. Tests

- Objectif proposé (jours cochés, report, jour ajouté), modifié, par défaut ; sans calendrier.
- Défis : progression séances / charge (charge max et 1RM, séance allégée ignorée), réussi daté,
  échoué, bornes de dates.
- Bilan : chaque bloc, comparaison au mois précédent, mois sans séance.
- Écrans : objectif du mois, nouveau défi (deux types, erreurs), liste et statuts, suppression, bilan
  ouvert depuis le Calendrier, ouverture automatique une seule fois, bandeau « Défi réussi ».
- SQL : `rls_check` (B ne voit pas les défis de A, `kind` invalide refusé, fin avant début refusée).
- Navigateur à 375 px.
