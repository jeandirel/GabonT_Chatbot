# Architecture d’intégration Web et mobile

## Sécurité et sessions

- OTP à six chiffres, haché par HMAC, expirant après cinq minutes et bloqué après cinq essais ;
- session Web en cookie `HttpOnly`, `Secure` en production, `SameSite=Strict` ;
- API mobile avec `X-Client-Type: mobile` lors de l’authentification puis `Authorization: Bearer <accessToken>` ; les jetons ne sont jamais exposés au JavaScript Web ;
- jeton d’accès 15 minutes, jeton de renouvellement rotatif 30 jours, révocation à la déconnexion ;
- PostgreSQL via Prisma pour les utilisateurs, passkeys, challenges, KYC, tickets, transactions, notifications et audit ;
- confirmation WebAuthn séparée, valable deux minutes et liée au type, au destinataire/référence et au montant exacts.

Routes : `POST /api/auth/otp`, `POST /api/auth/refresh`, `POST /api/auth/logout` et les quatre routes `/api/webauthn/*`.

## Chatbase API v2

Le navigateur appelle `POST /api/chat`; la clé Chatbase reste côté serveur. Le proxy conserve `conversationId`, associe un identifiant serveur et n’autorise que `getBalance`, `getTransactions`, `getCustomerProfile`, `createSupportTicket` et `getSupportTicket`. Les actions de compte sont refusées pour une conversation anonyme.

```env
CHATBASE_API_KEY=
CHATBASE_AGENT_ID=
```

Ces cinq noms doivent être créés comme Custom Actions dans Chatbase.

## Moov Money

- `GET /api/moov-money/balance`
- `GET /api/moov-money/transactions`
- `POST /api/moov-money/transactions`
- `POST /api/moov-money/airtime`
- `POST /api/moov-money/bills`

Les chemins des adaptateurs externes sont isolés dans `lib/server/moov-money.ts` et doivent être alignés une fois sur la documentation officielle Moov Money. Chaque mutation exige une clé d’idempotence et un jeton de confirmation forte ; le PIN et la biométrie brute ne transitent jamais.

`POST /api/webhooks/moov-money` vérifie la signature HMAC SHA-256, refuse les statuts inconnus, ignore les événements déjà traités et alimente transactions, notifications et audit.

## Assistance, diagnostic et KYC

- `POST /api/diagnostics` pour PIN bloqué, SIM, transfert en attente et solde incohérent ;
- `GET|POST /api/tickets` ;
- `POST /api/ocr` pour OCR français/anglais, extraction et empreinte SHA-256 ;
- `POST /api/uploads` pour le stockage privé compatible S3 avec chiffrement serveur ;
- `POST /api/kyc`

Le texte OCR, le score, les champs extraits, les hachages et les clés de stockage sont rattachés au dossier KYC. Les documents ne sont jamais placés dans un bucket public.

## Profil, sécurité et pilotage

- `GET|PATCH /api/profile` pour le profil et les langues FR/EN/Fang/Myene ;
- `GET|DELETE /api/security/devices` pour lister ou révoquer les passkeys sans pouvoir supprimer la dernière ;
- `GET /api/financial-insights` pour agréger les dépenses réelles des 30 derniers jours ;
- `GET /api/offers` pour les offres CRM ;
- `GET /api/admin/metrics`, protégé par `x-admin-api-key`, pour les volumes de comptes, transactions, tickets et KYC.

## Ce qui dépend encore des fournisseurs

Le code applicatif est prêt, mais aucune équipe ne peut inventer les contrats privés ou les secrets de production. Pour exécuter de vraies opérations, il faut fournir :

- schéma officiel, URL, clé et environnement de test Moov Money ;
- identifiants Chatbase et configuration des cinq Client Actions ;
- fournisseur SMS, CRM/ticketing/KYC et leurs contrats ;
- PostgreSQL, bucket S3 privé et secrets WebAuthn correspondant au domaine HTTPS.

## Obligatoire avant production

1. Aligner et tester les adaptateurs contre les environnements sandbox des fournisseurs.
2. Remplacer la limitation mémoire par Redis/API Gateway pour plusieurs instances.
3. Placer l’application derrière WAF, TLS, gestionnaire de secrets et supervision centralisée.
4. Réaliser tests de charge à 5 000 sessions, pentest, DPIA et validation COBAC/RGPD avant production.
