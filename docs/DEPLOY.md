# Déploiement manuel — teste → preprod → prod

Branches d’environnement sur [GabonT_Chatbot](https://github.com/jeandirel/GabonT_Chatbot) :

| Branche  | Rôle                                      |
|----------|-------------------------------------------|
| `teste`  | Environnement de test / QA                |
| `preprod`| Pré-production (validation avant prod)    |
| `prod`   | Production                                |

## Prérequis (secrets GitHub Actions)

Dans **Settings → Secrets and variables → Actions** :

- `VERCEL_TOKEN` — token Vercel (Account Settings → Tokens)
- `VERCEL_ORG_ID` — id org (fichier `.vercel/project.json` après `vercel link`)
- `VERCEL_PROJECT_ID` — id projet

Les environnements GitHub `teste`, `preprod`, `prod` sont créés au premier déploiement. Un admin peut y ajouter des **required reviewers** pour une approbation manuelle supplémentaire.

## Flux recommandé

1. Pousser / merger le code sur `teste`.
2. **Actions → Deploy → Run workflow** → target = `teste`.
3. **Actions → Promote → Run workflow** → `teste` → `preprod`.
4. **Actions → Deploy** → target = `preprod` (bloqué si `teste` n’a pas été déployé avec succès).
5. **Actions → Promote** → `preprod` → `prod`.
6. **Actions → Deploy** → target = `prod` (bloqué si `preprod` n’a pas été déployé avec succès).

En urgence uniquement : Deploy avec `skip_gate = true`.

## URLs

- Prod : déploiement Vercel `--prod` (domaine projet, ex. [gabon-t-chatbot.vercel.app](https://gabon-t-chatbot.vercel.app))
- Teste / preprod : alias preview `gabon-t-chatbot-teste.vercel.app` / `gabon-t-chatbot-preprod.vercel.app` (si le token le permet)

## Fullstack (API Railway)

Voir [DEPLOY_FULLSTACK.md](./DEPLOY_FULLSTACK.md).

- API teste : `https://api-production-c0fd.up.railway.app`
- Secrets Actions additionnels : `RAILWAY_TOKEN`, `RAILWAY_SERVICE_ID` (`2a19867c-defa-4beb-ac2e-cc85b38f53d4`)
