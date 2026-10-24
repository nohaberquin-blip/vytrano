# Fiche personnelle, besoins et suivi du poids — Design

Date : 2026-10-25

## 1. Objectif

Dans l'onglet Profil, l'utilisateur renseigne sexe, date de naissance, taille, niveau d'activité,
fréquence d'entraînement et objectif physique, note ses pesées et voit :
- ses besoins du jour (calories, protéines, glucides, lipides), réglables ;
- son IMC ;
- la courbe de son poids.

Ces informations sont **privées** : elles ne sont jamais visibles des amis.

## 2. Données (Postgres, migration 007 ; Dexie version 4)

| Table | Colonnes |
|---|---|
| `body_profiles` | `id uuid pk` (= `user_id`), `user_id uuid unique` ; `sex text null` (`male` / `female` / `unspecified`) ; `birth_date date null` ; `height_cm numeric(4,1) null` (120–230) ; `activity text null` (`sedentary` / `light` / `active` / `very_active`) ; `sessions_per_week smallint null` (0–14) ; `goal text null` (`bulk` / `cut` / `maintain` / `recomp` / `strength`) ; `kcal_override int null` (1000–6000) ; `protein_per_kg numeric(2,1) null` (1.0–3.0) ; `fat_pct smallint null` (15–40) ; `updated_at` |
| `weight_entries` | `id uuid pk` (id fixe déduit de user + date, comme le calendrier) ; `user_id` ; `date date not null` ; `weight_kg numeric(5,2) not null` (30–300) ; `updated_at` ; unique `(user_id, date)` |

Règles communes :
- RLS « chacun ses lignes » (`user_id = auth.uid()`), comme les tables du calendrier, avec suppression en cascade avec le compte.
- Synchronisation par le mécanisme existant (`repo.put` / `repo.remove`, outbox, `pull`).
- Colonnes numériques converties en nombres au `pull`.
- Le poids courant est **la dernière pesée** : il n'y a pas de colonne poids dans la fiche.
- Une pesée par jour au plus : une nouvelle pesée le même jour remplace l'ancienne.

## 3. Calculs (`src/domain/needs.ts`, fonctions pures)

Toutes les valeurs sont en kg et en cm ; l'affichage en lb passe par `useUnit`.

**Âge** : années révolues à la date du jour, à partir de `birth_date`.

**IMC** = poids ÷ (taille en m)², affiché avec une décimale.

| Catégorie | IMC |
|---|---|
| Maigreur | < 18,5 |
| Normal | 18,5 à < 25 |
| Surpoids | 25 à < 30 |
| Obésité | ≥ 30 |

**Métabolisme de base** (Mifflin-St Jeor) = 10 × poids + 6,25 × taille − 5 × âge + s, avec s :

| Sexe | s |
|---|---|
| Homme | + 5 |
| Femme | − 161 |
| Ne pas préciser | − 78 |

**Maintien** = métabolisme de base × (activité + 0,05 × séances par semaine).

| Activité | Facteur |
|---|---|
| Sédentaire | 1,2 |
| Peu actif | 1,3 |
| Actif | 1,4 |
| Très actif | 1,5 |

**Objectif** :

| Objectif | Calories | Protéines (g/kg) |
|---|---|---|
| Prise de masse | × 1,10 | 1,8 |
| Sèche | × 0,80 | 2,2 |
| Maintien | × 1,00 | 1,6 |
| Recomposition | × 0,95 | 2,0 |
| Force / performance | × 1,05 | 1,8 |

**Calories du jour** = `kcal_override` s'il existe, sinon maintien × facteur, arrondi à 10 kcal.

**Poids de référence** pour les grammes : le poids, sauf si IMC > 30, auquel cas c'est le poids
d'un IMC de 25 pour la taille (25 × taille²).

**Macros** :
- protéines (g) = (`protein_per_kg` ?? valeur de l'objectif) × poids de référence, arrondi au gramme ;
- lipides (g) = max((`fat_pct` ?? 25) % × calories ÷ 9, 0,6 × poids de référence), arrondi ;
- glucides (g) = max(0, (calories − 4 × protéines − 9 × lipides) ÷ 4), arrondi ;
- `carbsExhausted` est vrai si le calcul des glucides était négatif.

**Infos manquantes** : chaque résultat n'est calculé que si ses entrées existent.
- IMC : poids + taille.
- Métabolisme de base : poids + taille + âge + sexe.
- Maintien : en plus, activité + séances.
- Calories et macros : en plus, objectif. Exception : avec `kcal_override` et un poids, les macros
  restent calculables (objectif absent → 1,6 g/kg).

La fonction renvoie aussi la liste des champs manquants, pour le message.

**Moyenne sur 7 jours** (courbe) : pour chaque pesée, moyenne des pesées des 7 jours précédents,
jour même inclus.

## 4. Écrans (onglet Profil, au-dessus de « Mes séances »)

**Carte « Mes besoins »**
- « **2 200 kcal** par jour », puis « Protéines **165 g** · Glucides **248 g** · Lipides **61 g** ».
- Une barre de couleur avec la part de chaque macro en calories.
- Objectif ; détail « Métabolisme de base · Maintien · IMC 23,1 (normal) ».
- « (perso) » à côté d'une valeur réglée à la main.
- « Repères moyens, pas un avis médical. »
- Si les glucides sont épuisés : « 0 g de glucides : baisse les protéines ou les lipides ».
- S'il manque des infos : « Complète ta fiche pour voir tes besoins » et ce qui manque, avec le
  bouton « Ma fiche ».
- Bouton « **Ajuster** », qui ouvre un panneau :
  - Calories : « Auto » ou un nombre ;
  - Protéines (g/kg) ;
  - Lipides (%) ;
  - glucides affichés en direct (non réglables) ;
  - « Enregistrer » et « Revenir aux valeurs conseillées », qui remet les trois à `null`.

**Carte « Mon poids »**
- Dernière pesée et écart sur 30 jours (« − 1,2 kg en 30 jours »), s'il existe une pesée vieille de
  30 jours ou plus ; sinon depuis la première pesée.
- Courbe en SVG, sans bibliothèque : un point par pesée et une ligne pour la moyenne sur 7 jours.
- Période : 1 mois / 3 mois / 1 an / Tout (3 mois par défaut).
- « ＋ Pesée » ouvre un panneau : poids, date (aujourd'hui par défaut, pas dans le futur), « Enregistrer ».
- « Historique » : liste des pesées, la plus récente d'abord, avec suppression.
- Aucune pesée : « Ajoute ta première pesée ».

**Panneau « Ma fiche »** (bouton dans la carte « Mes besoins »)
- Champs : sexe, date de naissance (âge affiché), taille, activité (avec une description pour
  chaque choix), séances par semaine, objectif.
- Séances par semaine : pré-remplies avec le nombre de jours cochés du calendrier si le champ est
  vide.
- Contrôles :
  - âge entre 13 et 100 ans ;
  - taille entre 120 et 230 cm ;
  - séances entre 0 et 14.
- Message d'erreur sous le champ fautif ; « Enregistrer » est désactivé tant qu'une erreur reste.

## 5. Cas limites

- Poids saisi en lb : converti en kg pour l'enregistrement, et l'inverse pour l'affichage. Les
  bornes 30–300 s'appliquent au poids en kg.
- Pesée du même jour : elle remplace la précédente (id fixe).
- Ajustements gardés quand l'objectif change. Ils restent en place jusqu'à « Revenir aux valeurs
  conseillées ».
- Âge calculé le jour même : un anniversaire met à jour les besoins tout seul.

## 6. Tests

- Unitaires (`needs.ts`) :
  - exemples vérifiés à la main pour un homme, une femme et « Ne pas préciser » ;
  - chaque objectif ;
  - IMC > 30 et poids de référence ;
  - minimum de lipides ;
  - glucides épuisés ;
  - réglages perso ;
  - infos manquantes ;
  - âge la veille et le jour de l'anniversaire ;
  - moyenne sur 7 jours.
- Données :
  - pesée ajoutée, remplacée le même jour, supprimée ;
  - fiche enregistrée ;
  - pull des 2 tables, avec conversion numérique.
- Composants :
  - carte besoins (complète, incomplète, perso, glucides épuisés) ;
  - Ajuster (recalcul en direct, retour aux valeurs conseillées) ;
  - Ma fiche (erreurs, pré-remplissage) ;
  - pesée (lb) ;
  - courbe (périodes).
- SQL : `rls_check.sql` étendu (isolation des 2 tables et contraintes).
- Navigateur à 375 px, en clair et en sombre.
