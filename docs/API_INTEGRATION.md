# Architecture d’intégration

## Chatbase API v2

Le navigateur appelle `POST /api/chat`; la clé Chatbase reste côté serveur. Le proxy conserve `conversationId`, associe `userId` et accepte seulement : `getBalance`, `getTransactions`, `createSupportTicket`, `getSupportTicket`.

```env
CHATBASE_API_KEY=
CHATBASE_AGENT_ID=
```

Ces quatre noms doivent être créés comme Custom Actions dans Chatbase.

## Moov Money

- `GET /api/moov-money/balance`
- `GET /api/moov-money/transactions`
- `POST /api/moov-money/transactions`
- `POST /api/moov-money/bills`

Les chemins des adaptateurs externes sont à aligner sur la documentation officielle Moov Money. Chaque mutation utilise une clé d’idempotence et un jeton de confirmation opaque, jamais le PIN ou la biométrie brute.

## Ticketing et KYC

- `POST /api/tickets`
- `POST /api/kyc`

Sans URL externe, les adaptateurs fonctionnent en démonstration. Avec les variables d’environnement, les mêmes interfaces utilisent les services réels.

## Obligatoire avant production

1. Aligner les schémas sur les API Moov Money, CRM, ticketing et KYC.
2. Remplacer l’OTP de démonstration par l’identité Moov Money.
3. Ajouter session chiffrée, authentification serveur et limitation distribuée.
4. Vérifier les signatures de webhooks et journaliser les transactions de façon immuable.
5. Réaliser tests de charge, tests d’intrusion et audit COBAC/RGPD.
