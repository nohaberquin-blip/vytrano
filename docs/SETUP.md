# Mise en place de Supabase

1. Dans le projet Supabase, ouvrir **SQL Editor** → **New query**.
2. Coller et exécuter, dans l'ordre, le contenu de :
   1. `supabase/migrations/001_schema.sql`
   2. `supabase/migrations/002_rls.sql`
   3. `supabase/migrations/003_functions.sql`
   4. `supabase/seed_exercises.sql`
3. Exécuter `supabase/tests/rls_check.sql` : le résultat doit afficher **RLS OK**.
4. **Authentication → Providers → Email** : pour tester vite, désactiver « Confirm email »
   (sinon chaque inscription demande de cliquer un lien reçu par mail).
5. **Project Settings → API** : copier *Project URL* et la clé *anon public* dans `.env.local` :
   ```
   VITE_SUPABASE_URL=https://xxxx.supabase.co
   VITE_SUPABASE_ANON_KEY=...
   ```
6. `npm install` puis `npm run dev`.
