# Moov Assist

Application Web et API mobile Next.js/React/TypeScript conforme au cahier des charges `CDC-MM-BOT-2026-03`.

Le dépôt contient désormais de vrais workflows serveur : Chatbase v2, OTP, sessions Web/mobile, passkeys WebAuthn, confirmation forte des opérations, OCR Tesseract, stockage KYC S3 privé, PostgreSQL/Prisma, diagnostics, tickets, notifications, audit chaîné, webhooks signés et adaptateurs Moov Money.

## Démarrer

```bash
npm install
cp .env.example .env.local
npm run db:migrate
npm run dev
```

Sans variables d’intégration, les adaptateurs non sensibles utilisent des données de démonstration en développement. En production, la base, les secrets de session, le stockage KYC et les fournisseurs externes doivent être configurés ; aucun fallback sensible n’est accepté.

La biométrie est implémentée avec WebAuthn/passkeys : l’empreinte ou le visage reste dans l’enclave sécurisée de l’appareil. Le serveur ne reçoit et ne conserve qu’une preuve cryptographique.

## Validation

```bash
npm run typecheck
npm test
npm run build
```

Consultez [`docs/CDC_COVERAGE.md`](docs/CDC_COVERAGE.md), [`docs/API_INTEGRATION.md`](docs/API_INTEGRATION.md) et le contrat [`docs/openapi.yaml`](docs/openapi.yaml).
