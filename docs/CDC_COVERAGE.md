# Couverture du cahier des charges CDC-MM-BOT-2026-03

| Priorité | Exigence CDC | Interface | Backend | État |
| --- | --- | --- | --- | --- |
| P1 | FAQ 200+ et RAG | Assistant, Assistance | `POST /api/chat` → Chatbase v2 | Branchable |
| P1 | Diagnostic solde/PIN/SIM | Diagnostic interactif | `POST /api/diagnostics` + adaptateur Moov | Implémenté |
| P1 | Escalade humaine avec résumé | Assistance, suivi ticket | Ticket interne + adaptateur externe | Implémenté |
| P1 | Réclamations avec ticket | Formulaire et chronologie | `GET|POST /api/tickets` | Implémenté |
| P1 | Envoi d’argent | Bénéficiaire → montant → biométrie → reçu | Idempotence + contexte signé | Implémenté |
| P1 | Achat airtime/factures | Workflows complets | Adaptateurs Airtime et factures | Implémenté |
| P1 | Solde et historique | Dashboard, Assistant | Routes authentifiées | Implémenté |
| P1 | PIN ou biométrie | Passkey de l’appareil | WebAuthn avec vérification utilisateur obligatoire | Implémenté |
| P2 | Inscription guidée | Téléphone, OTP, passkey | OTP HMAC + sessions Web/mobile | Implémenté |
| P2 | KYC + OCR + suivi | Workflow KYC 4 étapes | OCR réel + S3 privé + PostgreSQL | Implémenté |
| P2 | Budget et épargne | Dashboard, Profil, Assistant | `GET /api/financial-insights` sur opérations réelles | Implémenté |
| P2 | Alertes inhabituelles | Sécurité, Notifications | Webhook HMAC + persistance | Implémenté |
| P3 | Promotions personnalisées | Offres dynamiques | `GET /api/offers` + adaptateur CRM | Implémenté |
| Transverse | Quick replies, voix, cartes | Assistant | Chatbase + dictée navigateur | Implémenté |
| Transverse | FR/Fang/Myene/EN | Assistant | Corpus/configuration Chatbase | À configurer |
| Pilotage | KPIs opérationnels | Administration | `GET /api/admin/metrics` protégé | Implémenté |
| NLU | Précision/rappel/F1 | Administration | Export Chatbase | À connecter |

## Cibles affichées au pilotage

- réponse moyenne < 2 s ; résolution automatique > 75 % ; précision NLU > 92 % ;
- disponibilité 99,9 % ; 5 000 sessions simultanées ; CSAT > 80 % ;
- 5 000 transactions/mois à M+6 ; 20 000 MAU en année 1.

Les codes PIN et données biométriques ne sont jamais stockés. L’empreinte/Face ID reste sur l’appareil ; le serveur vérifie une assertion WebAuthn et émet une confirmation éphémère liée à l’opération exacte.

« Implémenté » signifie que l’interface, la validation, la persistance et l’adaptateur sont codés. « Branchable » ou « à connecter » signifie qu’un contrat ou des identifiants externes restent à fournir par Moov Money/Chatbase ou le prestataire concerné.
