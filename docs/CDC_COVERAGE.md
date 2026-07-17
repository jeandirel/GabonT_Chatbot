# Couverture du cahier des charges CDC-MM-BOT-2026-03

| Priorité | Exigence CDC | Interface | Backend | État |
| --- | --- | --- | --- | --- |
| P1 | FAQ 200+ et RAG | Assistant, Assistance | `POST /api/chat` → Chatbase v2 | Branchable |
| P1 | Diagnostic solde/PIN/SIM | Assistant, Assistance | Actions Chatbase autorisées | Socle prêt |
| P1 | Escalade humaine avec résumé | Assistance, suivi ticket | `POST /api/tickets` | Branchable |
| P1 | Réclamations avec ticket | Formulaire et chronologie | Adaptateur ticketing | Branchable |
| P1 | Envoi d’argent | Bénéficiaire → montant → confirmation → reçu | API transactions | Branchable |
| P1 | Achat airtime/factures | Menu Paiements | Adaptateur Moov Money | Socle prêt |
| P1 | Solde et historique | Dashboard, Assistant | GET balance/transactions | Branchable |
| P1 | PIN ou biométrie | Confirmation forte | Jeton opaque éphémère | Branchable |
| P2 | Inscription guidée | Authentification | OTP de démonstration | Socle prêt |
| P2 | KYC + OCR + suivi | Workflow KYC 4 étapes | `POST /api/kyc` | Branchable |
| P2 | Budget et épargne | Dashboard, Profil, Assistant | Données Moov requises | UI prête |
| P2 | Alertes inhabituelles | Sécurité, Notifications | Webhooks à connecter | UI prête |
| P3 | Promotions personnalisées | Offres | CRM à connecter | UI prête |
| Transverse | Quick replies, voix, cartes | Assistant | Chatbase Client Actions | Socle prêt |
| Transverse | FR/Fang/Myene/EN | Assistant | Corpus/configuration Chatbase | À configurer |
| Pilotage | 6 KPIs contractuels | Administration | Analytics à connecter | UI prête |
| NLU | Précision/rappel/F1 | Administration | Export Chatbase | À connecter |

## Cibles affichées au pilotage

- réponse moyenne < 2 s ; résolution automatique > 75 % ; précision NLU > 92 % ;
- disponibilité 99,9 % ; 5 000 sessions simultanées ; CSAT > 80 % ;
- 5 000 transactions/mois à M+6 ; 20 000 MAU en année 1.

Les codes PIN et données biométriques ne sont jamais stockés. Le front échange uniquement un jeton de confirmation éphémère fourni par Moov Money.
