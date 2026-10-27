# Paramètres — Design

Date : 2026-10-27

## 1. Objectif

Regrouper tous les réglages dans une page « Paramètres » unique, rangée par catégories, avec une
recherche, et ajouter le choix du thème. Aucune donnée serveur nouvelle (pas de migration).

## 2. Décisions validées

- Accès : icône ⚙️ en haut à droite, à côté de « Profil » ; la barre du bas ne change pas.
- Apparence : thème « Système » / « Clair » / « Sombre », propre à l'appareil.
- Préférences d'entraînement : seulement les réglages existants (unité, repos automatique, écran
  allumé) ; les jours d'entraînement restent dans le Calendrier, la fiche corporelle dans le Profil,
  le temps disponible au début de la séance.
- Recherche : nom + mots-clés, sans tenir compte des accents ni des majuscules.

## 3. Page `/parametres`

- Lien ⚙️ dans l'en-tête (`aria-label="Paramètres"`), avant « Profil ».
- Titre « Paramètres », champ « Rechercher un paramètre » (type `search`), puis les catégories
  (titres `h2`, sections étiquetées) sur une seule page :

| Catégorie | Réglages (nom affiché) | Mots-clés |
|---|---|---|
| Apparence | Thème | sombre, clair, nuit, couleur, mode |
| Notifications | Alertes de repos | notification, notif, alerte, push |
| | Son | bip, sonnerie, audio |
| | Vibration | vibrer |
| Confidentialité | Partager mes séances avec mes amis | amis, partage, visible |
| | Montrer mon niveau et mes badges à mes amis | amis, partage, badges, niveau, progression |
| Préférences d'entraînement | Unité | kg, kilo, livre, lb, poids |
| | Repos automatique | minuteur, chrono, timer |
| | Garder l'écran allumé | veille, écran |
| Compte | Pseudo | nom, identifiant |
| | Se déconnecter | déconnexion, sortir |
| | Supprimer mon compte | supprimer, effacer, compte |

- Chaque réglage garde son texte d'aide actuel et son comportement actuel (enregistrement immédiat,
  erreurs, confirmation de déconnexion, double confirmation de suppression).

## 4. Recherche

- `normalize(s)` : minuscules, accents retirés (NFD), espaces en trop retirés.
- Un réglage correspond si la recherche normalisée est contenue dans son nom ou l'un de ses mots-clés.
- Recherche vide : tout est affiché. Catégories sans résultat masquées. Aucun résultat :
  « Aucun paramètre trouvé ».
- Le catalogue (catégorie, id, nom, mots-clés) est une liste pure (`src/features/settings/catalog.ts`)
  testée séparément de l'écran.

## 5. Thème

- `localStorage` `vytrano.theme` = `system` (défaut) | `light` | `dark`.
- Appliqué par l'attribut `data-theme` sur `<html>` (absent pour `system`) et la balise
  `meta[name=theme-color]` (`#f4f3ef` clair, `#111315` sombre).
- Un petit script inline dans `index.html` l'applique avant le premier affichage (pas de flash).
- CSS : chaque bloc `@media (prefers-color-scheme: dark)` devient
  `:root:not([data-theme="light"])` dans le media, et est repris pour `:root[data-theme="dark"]`.
- Sélecteur à trois boutons (`aria-pressed`), comme « Mois / Semaine ».
- Stockage indisponible : le thème suit le système, sans erreur.

## 6. Profil allégé

- Retirés du Profil : sections « Repos » et « Paramètres », interrupteur « Montrer mon niveau et mes
  badges » (sorti de la carte Régularité vers Confidentialité).
- Les composants existants (`RestSettingsSection`, `RestAlerts`, `SettingsSection`) sont réutilisés ou
  découpés par catégorie, sans changer leur logique.

## 7. Tests

- Catalogue : normalisation (accents, majuscules), nom, mot-clé, aucun résultat.
- Écran : 5 catégories visibles ; « sombre » ne montre qu'Apparence ; « vib » montre Vibration ;
  « zzz » → « Aucun paramètre trouvé » ; lien ⚙️ depuis l'en-tête.
- Thème : choisir « Sombre » pose `data-theme="dark"` et le retient ; « Système » le retire.
- Réglages déplacés : les tests existants passent depuis la page Paramètres ; le Profil ne les
  affiche plus.
- Navigateur à 375 px, clair et sombre.
