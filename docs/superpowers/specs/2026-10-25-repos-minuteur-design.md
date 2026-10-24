# Minuteur de repos et alertes — Design

Date : 2026-10-25

## 1. Objectif

Pendant une séance, un minuteur de repos démarre à chaque série validée. Sa durée est calculée
selon l'exercice, le type de série, la difficulté réelle et la charge. On peut l'ajuster (+15 s,
+30 s, −15 s) ou le passer. À la fin du repos :
- dans l'app : un bip, et une vibration sur Android ;
- téléphone verrouillé ou app en arrière-plan : une notification, que la montre connectée reçoit
  aussi.

Deux étapes livrées ensemble : **1. minuteur dans l'app**, **2. notifications push**.

## 2. Calcul du repos (`src/domain/rest.ts`, fonction pure)

`restSeconds(set, next, fiche, reference)` : `set` est la série qu'on vient de valider ; `next` est
la série suivante non validée (même exercice, sinon premier exercice suivant), ou `undefined`.

1. Pas de série suivante → pas de repos (`null`).
2. Série suivante rattachée (`drop`, `restpause`, `cluster`) → durée fixe, sans autre ajustement :
   `drop` 15 s, `restpause` 20 s, `cluster` 20 s.
3. Série validée = échauffement → 60 s, sans autre ajustement.
4. Base = `fiche.rest_seconds` s'il existe, sinon selon les reps visées de la série
   (`target_reps`, ou celles de la fiche si absentes) :

   | Reps visées | Base |
   |---|---|
   | ≤ 5 | 180 s |
   | 6 à 12 | 120 s |
   | > 12 | 75 s |
   | échec (aucune cible) | 120 s |

5. Ajustements, cumulés :
   - top-set ou AMRAP : + 30 s ;
   - reps faites < reps visées : + 30 s ;
   - reps faites ≥ (haut de fourchette ou reps visées) + 2 : − 15 s ;
   - charge ≥ 90 % de la référence de la fiche (référence > 0) : + 15 s.
6. Minimum 15 s, maximum 600 s.

## 3. Minuteur (étape 1)

- **État** : `{ workoutId, setId, endsAt, total, next }`, où `next` est le libellé de la série
  suivante (« Squat · série 3 · 100 kg × 5 »). Il est gardé dans `localStorage`
  (`vytrano.rest`) : il survit au verrouillage, à un rechargement et à l'onglet fermé. Le temps
  restant est toujours `endsAt − maintenant`.
- **Démarrage** : en validant une série (passage de `done` false → true) si « Repos automatique »
  est activé et que `restSeconds` n'est pas `null`. Un nouveau repos remplace le précédent.
- **Arrêt** :
  - annuler la validation de la série qui a lancé le repos ;
  - « Passer » ;
  - terminer ou abandonner la séance ;
  - fermer la barre une fois le repos fini.
- **Ajustements** : +15 s, +30 s et −15 s décalent `endsAt` ; jamais en dessous de maintenant + 5 s
  tant que le repos n'est pas fini.
- **Fin** : un seul signal par repos :
  - triple bip (Web Audio), si « Son » est activé ; le contexte audio est débloqué au toucher de
    validation ;
  - `navigator.vibrate([300, 100, 300])`, si « Vibration » est activé et que l'appareil le
    permet ;
  - ensuite, la barre affiche le dépassement (« +0:12 »).
- **Écran allumé** : Wake Lock pendant la séance si « Garder l'écran allumé » est activé (il est
  repris au retour au premier plan). Sans prise en charge, rien ne se passe.
- **Barre** :
  - fixée en bas de l'écran Séance, au-dessus des onglets ;
  - affiche le temps restant `m:ss`, une barre qui se vide et « Ensuite : … » ;
  - boutons « −15 s », « +15 s », « +30 s », « Passer » ;
  - repos fini : fond vert, « C'est reparti ! », « +m:ss » et le bouton « Fermer ».
- **Réglages** :
  - sur la fiche d'exercice, « Repos de base » : vide = Auto (la base selon les reps est indiquée
    en grisé) ; saisie `m:ss` ou en secondes, entre 10 et 600 s ;
  - dans le Profil, section « Repos », 4 interrupteurs : Repos automatique, Son, Vibration, Garder
    l'écran allumé. Tous activés par défaut, gardés dans `localStorage` (`vytrano.rest.settings`)
    car ils dépendent de l'appareil.

## 4. Notifications push (étape 2)

**Abonnement**
- Profil → Repos → bouton « Activer les alertes de repos ».
- Le bouton demande la permission, crée l'abonnement Web Push (clé publique VAPID) et l'enregistre
  dans `push_subscriptions`.
- iPhone hors écran d'accueil (`PushManager` absent) : à la place du bouton, un guide « Ajoute
  Vytrano à l'écran d'accueil : Partager → Sur l'écran d'accueil, puis rouvre l'app depuis
  l'icône ».
- Navigateur sans prise en charge : « Ton navigateur ne permet pas les alertes ».
- Une fois activé : « Alertes activées » et le bouton « Désactiver » (désabonnement et suppression
  de la ligne).

**Programmation**
- Quand la page passe en arrière-plan (`visibilitychange` → hidden) pendant un repos non fini,
  avec des alertes activées : upsert dans `rest_alarms` de
  `{ user_id, fire_at: endsAt, title: 'Repos terminé', body: next }`. Requête `fetch` avec
  `keepalive: true` vers l'API REST, avec le jeton de l'utilisateur.
- Retour au premier plan : suppression de la ligne `rest_alarms` de l'utilisateur. L'app au
  premier plan gère seule la fin du repos, donc pas de doublon.
- Une alarme par utilisateur au plus (clé `user_id`).

**Envoi**
- Tâche `pg_cron` toutes les 5 secondes : si une alarme est due, appel `pg_net` de l'Edge Function
  `rest-alarms`.
- La fonction :
  - supprime atomiquement les alarmes dues (`delete … where fire_at <= now() returning *`) ;
  - envoie la notification à chaque abonnement de l'utilisateur (bibliothèque `web-push`, clés
    VAPID en secrets de la fonction) ;
  - supprime les abonnements expirés (réponses 404 et 410).
- La fonction est déployée sans vérification de JWT : elle ne fait qu'envoyer les alarmes déjà
  dues, un appel extérieur n'a donc aucun effet nuisible.

**Service worker**
- `public/push-sw.js`, importé par le service worker de vite-plugin-pwa
  (`workbox.importScripts`).
- `push` : `showNotification(title, { body, tag: 'rest', renotify: true, vibrate: [300, 100, 300], icon })`.
- `notificationclick` : ramène l'app au premier plan, ou l'ouvre sur `/`.

**Montre** : Apple Watch et montres Android affichent les notifications du téléphone et vibrent. Il
n'y a rien de spécifique à faire.

## 5. Données (migration 008)

| Table / colonne | Définition |
|---|---|
| `user_exercises.rest_seconds` | `int null check (rest_seconds between 10 and 600)` |
| `push_subscriptions` | `id uuid pk default gen_random_uuid()`, `user_id` (cascade), `endpoint text unique not null`, `p256dh text not null`, `auth text not null`, `created_at` ; RLS chacun ses lignes |
| `rest_alarms` | `user_id uuid pk` (cascade), `fire_at timestamptz not null`, `title text not null`, `body text not null default ''`, `updated_at` ; RLS chacun sa ligne |

Migration 009, séparée car elle demande `pg_cron` et `pg_net` : la tâche planifiée qui appelle la
fonction.

## 6. Cas limites

- Deux appareils : l'alarme est envoyée à tous les abonnements de l'utilisateur.
- Séance terminée ou abandonnée pendant un repos : minuteur effacé et alarme supprimée.
- Hors connexion au moment de passer en arrière-plan : pas d'alarme ; l'alerte dans l'app
  fonctionne au retour.
- Retour dans l'app après la fin du repos sans notification reçue : la barre affiche le
  dépassement. Le bip ne sonne pas si la fin date de plus de 3 s, pour ne pas sonner en retard.
- iPhone en mode silencieux : bip et vibration de l'app sont absents ; la notification vibre
  normalement.

## 7. Tests

- `rest.ts` : chaque ligne du §2.
- Minuteur (hook et barre) :
  - démarrage à la validation ;
  - annulation ;
  - ajustements ;
  - passer ;
  - fin (bip et vibration appelés une seule fois) ;
  - dépassement ;
  - reprise depuis `localStorage` ;
  - réglages désactivés.
- Fiche : saisie du repos (`2:30` → 150, bornes).
- Programmation push :
  - `hidden` avec repos en cours → upsert ;
  - `visible` → suppression ;
  - sans abonnement → rien.
- SQL : `rls_check.sql` étendu (`push_subscriptions` et `rest_alarms` privés, contrainte
  `rest_seconds`).
- Navigateur à 375 px : barre, ajustements, fin. Notification réelle testée sur téléphone par
  l'utilisateur.
