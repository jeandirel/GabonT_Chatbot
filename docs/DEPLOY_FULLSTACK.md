# Déploiement fullstack — Next (Vercel) + FastAPI (Railway)

## Architecture

| Couche | Hébergeur | Source |
|--------|-----------|--------|
| Frontend Next.js | Vercel | branche `teste` / `preprod` / `prod` |
| API FastAPI | Railway | dossier `api/` (même commit) |

```
Navigateur ──HTTP──► Vercel (Next)
                │ MOOV_API_URL (server)
                └──► Railway (FastAPI) /api/chat, /api/voice/…
Navigateur ──WSS───► Railway /ws/live   (NEXT_PUBLIC_MOOV_API_URL)
```

## Variables

### Railway (`api`)

- Clés LLM / voix (voir `api/.env.example`)
- `CORS_ORIGINS` = URLs Vercel de l’environnement (séparées par des virgules)

Sync local → Railway (sans afficher les secrets) :

```bash
cd api
CORS_ORIGINS="https://….vercel.app,…" python3 scripts/sync_railway_env.py
railway up -y
```

### Vercel (`web`)

| Variable | Scope | Valeur |
|----------|-------|--------|
| `MOOV_API_URL` | Preview / Production | URL publique Railway (ex. `https://api-….up.railway.app`) |
| `NEXT_PUBLIC_MOOV_API_URL` | Preview / Production | **même URL** (WebSocket Live côté navigateur) |

Après changement d’env Vercel : **redeploy** obligatoire (les `NEXT_PUBLIC_*` sont baked au build).

## Smoke test

```bash
# API
curl -s https://api-….up.railway.app/api/health

# Front → proxy santé
curl -s https://….vercel.app/api/assistant/status
# attendu : "online": true
```

## Pipeline GitHub Actions

Workflow **Deploy** : valide → déploie Railway (`api/`) → déploie Vercel (web) → gate de promotion.
