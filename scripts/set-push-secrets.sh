#!/bin/sh
# Enregistre les clés VAPID (alertes de repos) dans les secrets de la fonction Supabase « rest-alarms ».
# Usage : sh scripts/set-push-secrets.sh <fichier vapid.json>
# La clé privée n'est jamais affichée ; le fichier temporaire est effacé à la fin.
set -e
KEYS="$1"
if [ ! -f "$KEYS" ]; then echo "❌ Fichier de clés introuvable : $KEYS"; exit 1; fi

ENV_FILE=$(mktemp)
trap 'rm -f "$ENV_FILE"' EXIT
python3 - "$KEYS" "$ENV_FILE" <<'PY'
import json, sys
k = json.load(open(sys.argv[1]))
open(sys.argv[2], 'w').write(
    'VAPID_SUBJECT=https://vytrano.vercel.app\n'
    f"VAPID_PUBLIC_KEY={k['publicKey']}\n"
    f"VAPID_PRIVATE_KEY={k['privateKey']}\n")
PY

npx --yes supabase@latest secrets set --project-ref kkusotincuwjjokyyfjl --env-file "$ENV_FILE" > /dev/null
echo "✅ Clés enregistrées dans Supabase."
