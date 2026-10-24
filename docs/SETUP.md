# Vytrano — mise en place de Supabase

1. Dans le projet Supabase, ouvrir **SQL Editor** → **New query**.
2. Coller et exécuter **en une fois** le contenu de `supabase/setup_all.sql`
   (il regroupe, dans l'ordre, `migrations/001` → `003` et `seed_exercises.sql`).
3. Exécuter `supabase/tests/rls_check.sql` : le résultat doit afficher **RLS OK**.
4. **Authentication → Providers → Email** : pour tester vite, désactiver « Confirm email »
   (sinon chaque inscription demande de cliquer un lien reçu par mail).
5. **Project Settings → API** : copier *Project URL* et la clé *anon public* dans `.env.local` :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
6. `npm install` puis `npm run dev`.

# Mise en ligne (Vercel + vytrano.com)

1. Code sur GitHub (dépôt privé), branche `main`.
2. vercel.com → **Add New → Project** → importer le dépôt. Framework : Vite (détecté).
   **Environment Variables** : `VITE_SUPABASE_URL` et `VITE_SUPABASE_ANON_KEY` (mêmes valeurs que `.env.local`).
3. Projet Vercel → **Settings → Domains** : ajouter `vytrano.com` et `www.vytrano.com`.
4. Namecheap → **Domain List → Manage → Advanced DNS** : créer les enregistrements indiqués par Vercel
   (en général `A  @  76.76.21.21` et `CNAME  www  cname.vercel-dns.com`), supprimer les anciens enregistrements de parking.
5. Supabase → **Authentication → URL Configuration** : *Site URL* = `https://vytrano.com`,
   *Redirect URLs* : ajouter `https://vytrano.com/**` et `https://www.vytrano.com/**`.
