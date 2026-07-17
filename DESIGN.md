---
name: Aetheric Intelligence
colors:
  surface: '#101415'
  surface-dim: '#101415'
  surface-bright: '#363a3b'
  surface-container-lowest: '#0b0f10'
  surface-container-low: '#191c1e'
  surface-container: '#1d2022'
  surface-container-high: '#272a2c'
  surface-container-highest: '#323537'
  on-surface: '#e0e3e5'
  on-surface-variant: '#bbcbbb'
  inverse-surface: '#e0e3e5'
  inverse-on-surface: '#2d3133'
  outline: '#869486'
  outline-variant: '#3d4a3e'
  surface-tint: '#4ae183'
  primary: '#54e98a'
  on-primary: '#003919'
  primary-container: '#2ecc71'
  on-primary-container: '#005027'
  inverse-primary: '#006d37'
  secondary: '#e9c349'
  on-secondary: '#3c2f00'
  secondary-container: '#af8d11'
  on-secondary-container: '#342800'
  tertiary: '#c6cee8'
  on-tertiary: '#283044'
  tertiary-container: '#abb2cc'
  on-tertiary-container: '#3d455a'
  error: '#ffb4ab'
  on-error: '#690005'
  error-container: '#93000a'
  on-error-container: '#ffdad6'
  primary-fixed: '#6bfe9c'
  primary-fixed-dim: '#4ae183'
  on-primary-fixed: '#00210c'
  on-primary-fixed-variant: '#005228'
  secondary-fixed: '#ffe088'
  secondary-fixed-dim: '#e9c349'
  on-secondary-fixed: '#241a00'
  on-secondary-fixed-variant: '#574500'
  tertiary-fixed: '#dae2fd'
  tertiary-fixed-dim: '#bec6e0'
  on-tertiary-fixed: '#131b2e'
  on-tertiary-fixed-variant: '#3f465c'
  background: '#101415'
  on-background: '#e0e3e5'
  surface-variant: '#323537'
typography:
  display-lg:
    fontFamily: Hanken Grotesk
    fontSize: 48px
    fontWeight: '700'
    lineHeight: 56px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Hanken Grotesk
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
    letterSpacing: -0.01em
  headline-lg-mobile:
    fontFamily: Hanken Grotesk
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Geist
    fontSize: 12px
    fontWeight: '500'
    lineHeight: 16px
    letterSpacing: 0.05em
rounded:
  sm: 0.25rem
  DEFAULT: 0.5rem
  md: 0.75rem
  lg: 1rem
  xl: 1.5rem
  full: 9999px
spacing:
  unit: 8px
  container-max: 1440px
  gutter: 24px
  margin-mobile: 16px
  margin-desktop: 64px
  stack-sm: 4px
  stack-md: 16px
  stack-lg: 32px
---

## Brand & Style
The design system embodies "Aetheric Intelligence"—a fusion of high-end fintech reliability and the fluid, predictive nature of advanced AI. The brand personality is prestigious yet approachable, acting as a sophisticated financial concierge rather than a static tool.

The visual direction utilizes **Liquid UI** and **Glassmorphism**. Interfaces should feel atmospheric and weightless, using light as a directional cue to guide the user's focus. The emotional response is one of absolute security, effortless control, and forward-thinking innovation. High-end professional aesthetics are maintained through generous whitespace and a "less but better" approach to information density.

## Colors
This design system defaults to a "Midnight Deep" dark mode to emphasize depth and the glow of conversational AI elements. 

- **Primary Green (#2ECC71):** Used for growth indicators, successful transaction states, and primary action highlights. It represents vitality and movement.
- **Premium Gold (#D4AF37):** Reserved for high-value features, rewards, and "Elite" tier UI elements. Use sparingly to maintain a sense of luxury.
- **Deep Blue (#0F172A):** The foundation color for surfaces and deep backgrounds, providing a stable, institutional feel.
- **Pure White & Soft Gray:** Used for high-contrast typography and subtle secondary information.

In Light Mode, the surfaces transition to ultra-high-clarity whites with soft blue-gray shadows, maintaining the glassmorphic highlights.

## Typography
The typography strategy prioritizes mathematical precision and premium editorial feel. 

**Hanken Grotesk** is used for high-level headings to provide a sharp, modern fintech vibe. **Inter** handles the heavy lifting of banking data and conversational text, ensuring maximum legibility across all optical sizes. **Geist** is utilized for labels and monospaced financial data (like transaction IDs or account numbers), evoking a technical, developer-grade reliability.

Hierarchy is enforced through weight and letter spacing rather than just size. Headlines should be tightly tracked, while labels benefit from slight expansion to improve scanability.

## Layout & Spacing
The layout follows a **Fluid Grid** system based on an 8px base unit. To achieve the "Liquid UI" feel, the design system utilizes wide margins and adaptive padding that expands as the user moves into deep-focus AI tasks.

- **Desktop:** 12-column grid with 64px outside margins. Focus content (like AI chat) occupies a centered 8-column container.
- **Mobile:** 4-column grid with 16px margins.
- **Rhythm:** Vertical spacing should be generous. Use `stack-lg` (32px) between major functional blocks to maintain the minimalist, luxury aesthetic.

## Elevation & Depth
Depth is created through **Glassmorphism** and **Dynamic Lighting** rather than traditional drop shadows.

1.  **Level 0 (Base):** The deep background, often featuring subtle, slow-moving organic gradients (auroras) in the primary colors.
2.  **Level 1 (Floating Cards):** Semi-transparent surfaces (Background Blur: 20px-40px) with a 1px inner border (stroke) using a high-opacity white or gold to simulate glass edges.
3.  **Level 2 (Active AI Elements):** These elements use a "backlight" effect—a soft, colored outer glow that pulses slightly to indicate AI processing.

Shadows, when used, are extremely diffused (Blur: 60px) and tinted with the secondary Deep Blue color to avoid a "dirty" look.

## Shapes
The shape language is "Organic Geometric." While cards and containers use a standard `rounded-lg` (16px) or `rounded-xl` (24px) to suggest structure and safety, decorative elements and background blobs should use irregular, spline-based paths.

Interactive elements like buttons use `rounded-xl` (24px) to create a soft, approachable touch point. AI conversational bubbles use asymmetric rounding (e.g., three corners at 24px, one corner at 4px) to indicate directionality and flow.

## Components

### Conversational Cards
The core of the ecosystem. These are adaptive glass containers that change height based on the AI's response. They must feature a subtle "shimmer" animation across the top border when the AI is "thinking."

### Luxury Action Buttons
Primary buttons use a solid Primary Green to White gradient with a subtle Gold inner glow. They should feel tactile, with a slight scale-down (0.98) on press.

### Transaction Lists
Use high-contrast labels. Amount values should be displayed in `Geist` to emphasize precision. Use "ghost" separators (0.5px lines with 10% opacity) to maintain a clean aesthetic.

### KYC & Input Fields
Fields should not have a solid background. Use a bottom-border only or a very faint glass background. Focus states are indicated by the border turning into a Primary Green gradient glow.

### Financial Insights (Data Viz)
Charts should use "Liquid" lines—smooth, rounded paths rather than jagged edges. Use the Primary Green and Accent Blue for data series, with Gold reserved for "Goal Achieved" markers.