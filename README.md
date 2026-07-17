# Moov Assist — prototype front-end

Prototype navigable créé à partir des écrans Google Stitch pour valider l'expérience utilisateur avant l'intégration du moteur IA et des API métier.

## Écrans

- Tableau de bord (`index.html`)
- Assistant IA (`assistant.html`)
- Paiements et transferts (`payments.html`)
- Vérification KYC (`kyc.html`)
- Centre de sécurité (`security.html`)
- Profil et gestion financière (`profile.html`)

## Lancer le prototype

Le projet est volontairement statique et sans compilation :

```bash
python3 -m http.server 8080 --directory .
```

Ouvrir ensuite `http://localhost:8080`.

Les actions affichent actuellement des confirmations simulées. `app.js` centralise la navigation et les interactions temporaires ; les appels au futur backend pourront y être remplacés progressivement par un client API dédié.

## Architecture API prévue

- `/api/chat` : moteur conversationnel/RAG
- `/api/accounts` : soldes et comptes
- `/api/transactions` : paiements et historique
- `/api/kyc` : vérification d'identité
- `/api/security` : sessions, appareils et alertes

Le fichier `DESIGN.md` conserve les règles graphiques issues de Stitch.
