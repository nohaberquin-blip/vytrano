# Vytrano — mise en place de Supabase

1. Dans le projet Supabase, ouvrir **SQL Editor** → **New query**.
2. Coller et exécuter **en une fois** le contenu de `supabase/setup_all.sql`
   (il regroupe `migrations/001` → `003`, `seed_exercises.sql` puis `migrations/004` → `007`).
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

# Mise en ligne (Vercel)

Adresse actuelle : **https://vytrano.vercel.app** (projet Vercel `xoly/vytrano`).

Pour publier une nouvelle version, depuis le dossier du projet :
```
npx vercel@latest deploy --prod --yes --build-env VITE_SUPABASE_URL=<url> --build-env VITE_SUPABASE_ANON_KEY=<clé publique>
```
(même valeurs que `.env.local` ; `npx vercel@latest login` si l'outil demande de se connecter).

Supabase → **Authentication → URL Configuration** : *Site URL* = `https://vytrano.vercel.app`,
*Redirect URLs* : `https://vytrano.vercel.app/**`.

## Plus tard : domaine vytrano.com

`vytrano.com` et `www.vytrano.com` sont déjà ajoutés au projet Vercel. Le domaine est suspendu chez
Namecheap (expiré le 21/09/2026). Après renouvellement :
1. Namecheap → **Manage** → **Nameservers** → **Custom DNS** : `ns1.vercel-dns.com`, `ns2.vercel-dns.com` (✓ pour enregistrer).
2. Supabase : *Site URL* = `https://vytrano.com`, ajouter `https://vytrano.com/**` et `https://www.vytrano.com/**` aux Redirect URLs.
