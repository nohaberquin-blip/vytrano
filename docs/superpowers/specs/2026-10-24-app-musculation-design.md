# App de musculation — Design

Date : 2026-10-24

## 1. Objectif

Une web app installable (PWA) pour suivre son programme de musculation à la salle,
ouverte à un nombre illimité d'utilisateurs, avec une dimension sociale légère
(fil des séances de ses amis + réaction 💪).

**Critère de succès** : enregistrer une séance complète plus vite qu'avec un carnet,
sans jamais perdre de données, même sans réseau.

## 2. Périmètre V1

Inclus :
- Comptes individuels (email + mot de passe), pseudo unique.
- Création de programmes (jours → exercices).
- Onglet « Mes exercices » : fiche modifiable par exercice (charge, séries, reps, palier).
- Séance guidée avec progression automatique (règle simple).
- Partage d'un programme par code (import = copie indépendante).
- Amis : recherche par pseudo, demande, acceptation ; fil des séances ; réaction 💪.
- Paramètre « Partager mes séances » (activé par défaut).
- Fonctionnement hors ligne pendant la séance, synchronisation au retour du réseau.

Exclus (V2 éventuelle) : commentaires, records mis en avant, double progression,
deload, schémas en % du 1RM, graphiques de progression, notifications push.

## 3. Architecture

- **Front** : React + Vite + TypeScript, PWA (`vite-plugin-pwa`), React Router.
- **Données locales** : IndexedDB via Dexie (cache + file d'écritures en attente).
- **Backend** : Supabase — Auth, Postgres, Row Level Security (RLS). Aucun serveur maison.
- **Hébergement** : Vercel (front) + offre gratuite Supabase au départ.
- **Tests** : Vitest (logique pure), Testing Library (composants clés).

Découpage du front :
- `src/domain/` — logique pure sans dépendance (progression, calculs de séance). Testée unitairement.
- `src/data/` — accès aux données : client Supabase, base locale Dexie, moteur de sync.
- `src/features/<onglet>/` — écrans et composants par onglet.
- `src/app/` — routing, layout, barre d'onglets, garde d'authentification.

## 4. Modèle de données (Postgres)

Toutes les tables ont `id uuid` (généré côté client pour permettre la création hors ligne),
`created_at`, `updated_at`.

| Table | Colonnes principales |
|---|---|
| `profiles` | `user_id` (= auth.users.id), `username` unique, `display_name`, `share_workouts bool default true`, `unit` ('kg'\|'lb') |
| `exercises` | `owner_id` (null = catalogue global), `name`, `muscle_group` |
| `user_exercises` | `user_id`, `exercise_id`, `current_weight`, `sets`, `target_reps`, `increment` — **la fiche « Mes exercices »**, unique par (user, exercise) |
| `programs` | `owner_id`, `name`, `is_active`, `share_code` (null si non partagé) |
| `program_days` | `program_id`, `position`, `name` |
| `program_day_exercises` | `day_id`, `exercise_id`, `position` |
| `workouts` | `user_id`, `program_day_id`, `started_at`, `finished_at`, `status` ('in_progress'\|'done') |
| `workout_sets` | `workout_id`, `exercise_id`, `position`, `target_reps`, `reps`, `weight`, `done bool` |
| `friendships` | `requester_id`, `addressee_id`, `status` ('pending'\|'accepted') — unique par paire |
| `reactions` | `workout_id`, `user_id` — unique par paire |

**Décision : les charges vivent dans `user_exercises`** (une fiche par exercice et par utilisateur).
Un exercice présent dans plusieurs jours partage la même charge. Les programmes ne
contiennent que la structure (quels exercices, quel jour, dans quel ordre).

### Règles d'accès (RLS)

- `profiles` : lecture par tout utilisateur connecté (recherche) ; écriture par soi.
- `exercises` : lecture du catalogue global + des siens ; écriture des siens.
- `user_exercises`, `programs*` : lecture/écriture par le propriétaire.
  Exception : un programme avec `share_code` est lisible via une fonction RPC
  `import_program(code)` qui copie programme, jours et exercices chez l'appelant
  et crée les `user_exercises` manquants (charge 0, 3×10, palier 2,5 kg par défaut).
- `workouts`, `workout_sets` : lecture par le propriétaire, **ou** par un ami accepté
  si `profiles.share_workouts = true` pour le propriétaire. Écriture par le propriétaire.
- `friendships` : lecture par les deux parties ; création par le demandeur ;
  passage à 'accepted' par le destinataire uniquement ; suppression par l'une ou l'autre.
- `reactions` : création/suppression par soi, sur une séance qu'on a le droit de lire ;
  lecture par qui peut lire la séance.

## 5. Progression automatique

Fonction pure `nextWeight(fiche, dernièresSéries)` dans `src/domain/progression.ts` :

- Si toutes les séries de la dernière séance de cet exercice sont `done` **et**
  `reps ≥ target_reps` → `current_weight + increment`.
- Sinon → `current_weight` inchangé.
- Aucune séance précédente → `current_weight`.

À la fin d'une séance, pour chaque exercice réalisé, la nouvelle charge est écrite dans
`user_exercises.current_weight`. L'utilisateur peut toujours la corriger à la main dans
« Mes exercices ».

## 6. Écrans

Barre d'onglets : **Séance · Programmes · Mes exercices · Amis**, avec Profil/Paramètres
accessible depuis l'en-tête.

1. **Séance** : prochaine séance du programme actif (rotation des jours dans l'ordre)
   + bouton Commencer. En séance : une carte par exercice avec la cible
   (« 4 × 8 à 62,5 kg », ↑ si hausse), la dernière performance, une ligne par série
   pré-remplie, un ✓ pour valider. Bouton Terminer. Une séance en cours est reprise
   après fermeture de l'app.
2. **Programmes** : liste, programme actif, créer/modifier (jours, exercices pris dans
   le catalogue ou créés), Partager (génère un code), Importer (coller un code).
3. **Mes exercices** : liste de mes fiches ; chaque fiche est modifiable
   (charge, séries, reps visées, palier) ; historique récent de l'exercice.
4. **Amis** : fil des séances terminées des amis (pseudo, nom, date, résumé, 💪 + compteur),
   détail d'une séance ; recherche par pseudo, demandes reçues, liste d'amis.
5. **Profil / Paramètres** : historique de mes séances, pseudo, partager mes séances (oui/non),
   unité, déconnexion, suppression du compte.

Premier lancement : inscription → choix du pseudo → créer un programme ou importer un code.

## 7. Hors ligne et synchronisation

- Les écritures (séances, séries, fiches, programmes) vont d'abord dans Dexie, puis dans une
  file `outbox`. Un moteur de sync pousse la file vers Supabase dès que le réseau revient
  (événement `online` + au démarrage), en upsert par `id`.
- Chaque utilisateur n'écrit que ses propres données : pas de conflit entre utilisateurs.
  Entre deux appareils d'un même utilisateur : la dernière écriture (`updated_at`) gagne.
- Lecture : on affiche le cache local immédiatement, puis on rafraîchit depuis Supabase.
- Les fonctions sociales (fil, recherche, demandes, 💪) nécessitent le réseau ; hors ligne,
  l'onglet Amis affiche le dernier fil en cache avec un bandeau « hors ligne ».

## 8. Erreurs

- Échec de sync : l'élément reste dans l'outbox, nouvel essai avec délai croissant ;
  indicateur discret « non synchronisé » dans l'en-tête.
- Refus RLS / erreur de validation (ex. pseudo déjà pris) : message clair à l'endroit concerné.
- Session expirée : redirection vers la connexion sans perdre les données locales.

## 9. Tests

- Unitaires (Vitest) : progression, rotation des jours, construction d'une séance à partir
  du programme et des fiches, file de sync (avec un faux client).
- Composants (Testing Library) : saisie et validation d'une série, édition d'une fiche.
- RLS : script SQL de vérification (un ami voit / ne voit plus quand `share_workouts = false`,
  un non-ami ne voit rien).
- Vérification manuelle dans le navigateur, en vue mobile.
