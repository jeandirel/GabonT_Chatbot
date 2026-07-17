# Moov Assist

Application Next.js/React/TypeScript conforme au cahier des charges `CDC-MM-BOT-2026-03`.

## Démarrer

```bash
npm install
cp .env.example .env.local
npm run dev
```

Sans variables, les intégrations utilisent des données de démonstration. Avec `CHATBASE_API_KEY` et `CHATBASE_AGENT_ID`, l’assistant appelle l’API Chatbase v2 et exploite la documentation chargée dans l’agent.

## Validation

```bash
npm run typecheck
npm run build
```

Consultez [`docs/CDC_COVERAGE.md`](docs/CDC_COVERAGE.md) et [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md).
