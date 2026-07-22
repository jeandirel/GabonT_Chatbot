---
name: Moov Assist — Gabon Telecom
colors:
  orange: '#FF6A00'
  orange-deep: '#E85D04'
  amber: '#FFB703'
  brand-blue: '#0057B8'
  navy: '#0B1F33'
  navy-soft: '#132A42'
  teal: '#00C2A8'
  mist: '#E8F1F8'
  ink: '#0F1720'
  online: '#22C55E'
typography:
  display: Outfit
  body: Outfit
  labels: Outfit
rounded:
  sm: 12px
  md: 18px
  lg: 24px
  xl: 28px
  pill: 999px
---

## Brand & Style

Identité **Gabon Telecom · Moov Africa** : orange signature + bleu royal du logo, teal signal (écoute / connecté).

Direction visuelle : **glassmorphisme + atmosphère équatoriale** (blobs orange / bleu / teal), clair par défaut. Pas de green fintech, pas de purple AI.

Personnalité : proche, telecom, vocal-first, fiable — concierge client, pas dashboard bancaire froid.

## Surfaces

1. **Base** — dégradé mist + auras orange/bleu lentes  
2. **Glass** — `backdrop-filter: blur(20–28px)`, fill blanc/navy translucide, bord 1px blanc/orange faible  
3. **Actif IA** — glow orange (idle/speaking), teal (listening), blue (thinking)

## Typographie

**Outfit** partout (display + body). Tracking serré sur titres, labels en uppercase espacé pour wordmarks (GABON TELECOM / MOOV AFRICA).

## Composants clés

- **Bulle Moov** — forme liquide morphante (pas un cercle figé), états idle / listening / thinking / speaking  
- **Bulles chat** — glass asymétrique (user orange, assistant mist)  
- **CTA** — orange plein `#FF6A00` → `#E85D04`, texte blanc  
- **Soon barrier** — glass + flou preview, CTA vers `/assistant`

## Motion

- Entrées : `ease-out-cubic` 280–620 ms  
- Bulle : breathe 2.4 s, pulse écoute, morph liquide  
- Réduit : `prefers-reduced-motion`

## Structure produit (ne pas casser)

`MoovApp` shell · `AssistantStage` · `Workflows` · `ComingSoonBarrier` · routes `app/[screen]` · API Next proxy → FastAPI.
