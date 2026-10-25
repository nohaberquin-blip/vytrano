# Vytrano — mise en place de Supabase

1. Dans le projet Supabase, ouvrir **SQL Editor** → **New query**.
2. Coller et exécuter **en une fois** le contenu de `supabase/setup_all.sql`
   (il regroupe `migrations/001` → `003`, `seed_exercises.sql` puis `migrations/004` → `008` puis `010` → `012`).
   Sur un projet déjà installé, coller seulement les nouveaux fichiers de `supabase/migrations/`.
3. Exécuter `supabase/tests/rls_check.sql` : le résultat doit afficher **RLS OK**.
4. **Authentication → Providers → Email** : pour tester vite, désactiver « Confirm email »
   (sinon chaque inscription demande de cliquer un lien reçu par mail).
5. **Project Settings → API** : copier *Project URL* et la clé *anon public* dans `.env.local` :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
6. `npm install` puis `npm run dev`.

# Alertes de repos (notifications push)

1. **Database → Extensions** : activer `pg_cron` et `pg_net`.
2. Clés VAPID : `npx web-push generate-vapid-keys --json`. La clé publique va dans `.env.local`
   (`VITE_VAPID_PUBLIC_KEY=...`) et dans la commande de build Vercel ; la clé privée ne va **que** dans les
   secrets de la fonction.
3. `npx supabase login`, puis :
   ```
   npx supabase secrets set --project-ref kkusotincuwjjokyyfjl VAPID_SUBJECT=mailto:... VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=...
   npx supabase functions deploy rest-alarms --no-verify-jwt --project-ref kkusotincuwjjokyyfjl
   ```
4. Coller et exécuter `supabase/migrations/009_repos_cron.sql` (tâche toutes les 5 secondes).
5. Sur iPhone, les notifications ne marchent que dans l'app ajoutée à l'écran d'accueil (iOS 16.4+).

# Mise en ligne (Vercel)

Adresse actuelle : **https://vytrano.vercel.app** (projet Vercel `xoly/vytrano`).

**Avant de publier**, exécuter dans Supabase toute nouvelle migration (par exemple `010_temps_disponible.sql`)
puis `tests/rls_check.sql` (« RLS OK »). Sinon, l'app envoie des colonnes que la base ne connaît pas encore
et la synchronisation reste bloquée jusqu'à ce que la migration soit faite.

Pour publier une nouvelle version, depuis le dossier du projet :
```
npx vercel@latest deploy --prod --yes --build-env VITE_SUPABASE_URL=<url> --build-env VITE_SUPABASE_ANON_KEY=<clé publique> --build-env VITE_VAPID_PUBLIC_KEY=<clé VAPID publique>
```
(même valeurs que `.env.local` ; `npx vercel@latest login` si l'outil demande de se connecter).

Supabase → **Authentication → URL Configuration** : *Site URL* = `https://vytrano.vercel.app`,
*Redirect URLs* : `https://vytrano.vercel.app/**`.

## Plus tard : domaine vytrano.com

`vytrano.com` et `www.vytrano.com` sont déjà ajoutés au projet Vercel. Le domaine est suspendu chez
Namecheap (expiré le 21/09/2026). Après renouvellement :
1. Namecheap → **Manage** → **Nameservers** → **Custom DNS** : `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (✓ pour enregistrer).
2. Supabase : *Site URL* = `https://vytrano.com`, ajouter `https://vytrano.com/**` et `https://www.vytrano.com/**` aux Redirect URLs.
