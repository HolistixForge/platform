# Style System

This document describes the 3-layer color token architecture used across the platform.

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│  Layer 3: Domain Tokens (package SCSS files)            │
│  Module-specific colors: --color-kernel, --c-led-blue   │
│  References primitives or semantic tokens               │
├─────────────────────────────────────────────────────────┤
│  Layer 2: Semantic Tokens (variables.scss)               │
│  Purpose-based: --color-bg-app, --color-text, --color-error │
│  ★ Components use this layer for standard UI ★          │
├─────────────────────────────────────────────────────────┤
│  Layer 1: Primitives (variables.scss)                    │
│  OKLCH-derived shades: --primary-500, --surface-800     │
│  Components rarely reference these directly              │
└─────────────────────────────────────────────────────────┘
```

## When to Use Each Layer

| Situation             | Use                      | Example                       |
| --------------------- | ------------------------ | ----------------------------- |
| Background color      | Semantic                 | `var(--color-bg-surface)`     |
| Text color            | Semantic                 | `var(--color-text)`           |
| Border color          | Semantic                 | `var(--color-border)`         |
| Error/success/warning | Semantic                 | `var(--color-error)`          |
| Accent / brand        | Semantic                 | `var(--color-accent)`         |
| Kernel indicator      | Domain (jupyter)         | `var(--color-kernel)`         |
| Chat bubble color     | Domain (chats)           | `var(--color-chat-default)`   |
| LED status light      | Domain (user-containers) | `var(--c-led-blue)`           |
| Edge type color       | Domain (whiteboard)      | `var(--color-edge-reference)` |
| Building a new token  | Primitive                | `var(--primary-500)`          |

## Primitive Palette Reference

All primitives are OKLCH-derived with consistent lightness/chroma curves.

### Shade Scale

| Shade | L    | C    | Role                      |
| ----- | ---- | ---- | ------------------------- |
| 100   | 0.93 | 0.04 | Lightest, near-white tint |
| 200   | 0.82 | 0.08 | Light                     |
| 300   | 0.72 | 0.14 | Light accent              |
| 400   | 0.62 | 0.18 | Medium                    |
| 500   | 0.52 | 0.20 | Base (most saturated)     |
| 600   | 0.42 | 0.16 | Dark accent               |
| 700   | 0.32 | 0.12 | Dark                      |
| 800   | 0.22 | 0.07 | Very dark                 |
| 900   | 0.13 | 0.04 | Darkest                   |

### Primary (H=300, brand purple/magenta)

| Token           | Hex     | OKLCH               |
| --------------- | ------- | ------------------- |
| `--primary-100` | #ece2ff | L=0.93 C=0.04 H=300 |
| `--primary-200` | #ccb9f1 | L=0.82 C=0.08 H=300 |
| `--primary-300` | #b28fef | L=0.72 C=0.14 H=300 |
| `--primary-400` | #9867e1 | L=0.62 C=0.18 H=300 |
| `--primary-500` | #7d40c8 | L=0.52 C=0.20 H=300 |
| `--primary-600` | #5c2f95 | L=0.42 C=0.16 H=300 |
| `--primary-700` | #3e1e65 | L=0.32 C=0.12 H=300 |
| `--primary-800` | #201136 | L=0.22 C=0.07 H=300 |
| `--primary-900` | #0a0415 | L=0.13 C=0.04 H=300 |

### Surface (H=280, dark-theme surfaces)

| Token           | Hex     |
| --------------- | ------- |
| `--surface-100` | #e2e6ff |
| `--surface-200` | #b9bff8 |
| `--surface-300` | #9499fa |
| `--surface-400` | #7474ef |
| `--surface-500` | #594fd7 |
| `--surface-600` | #413aa0 |
| `--surface-700` | #2a266d |
| `--surface-800` | #15153a |
| `--surface-900` | #050517 |

### Cyan (H=230, data/interactive)

| Token        | Hex     |
| ------------ | ------- |
| `--cyan-100` | #ceeefe |
| `--cyan-200` | #8dceee |
| `--cyan-300` | #16b3eb |
| `--cyan-400` | #0095dc |
| `--cyan-500` | #0076c4 |
| `--cyan-600` | #005792 |
| `--cyan-700` | #003a63 |
| `--cyan-800` | #001f34 |
| `--cyan-900` | #000914 |

### Red (H=25, error/danger)

| Token       | Hex     |
| ----------- | ------- |
| `--red-100` | #ffdedb |
| `--red-200` | #f4b0aa |
| `--red-300` | #f07f77 |
| `--red-400` | #de4e4b |
| `--red-500` | #c21725 |
| `--red-600` | #90101a |
| `--red-700` | #62090f |
| `--red-800` | #340909 |
| `--red-900` | #140202 |

### Orange (H=50, warning)

| Token          | Hex     |
| -------------- | ------- |
| `--orange-100` | #ffe1d1 |
| `--orange-200` | #efb696 |
| `--orange-300` | #e9884d |
| `--orange-400` | #d75c00 |
| `--orange-500` | #bc3000 |
| `--orange-600` | #8c2300 |
| `--orange-700` | #5f1600 |
| `--orange-800` | #330d00 |
| `--orange-900` | #130300 |

### Yellow (H=85, debug/info)

| Token          | Hex     |
| -------------- | ------- |
| `--yellow-100` | #f4e6ca |
| `--yellow-200` | #dcc188 |
| `--yellow-300` | #cd9c1f |
| `--yellow-400` | #b77900 |
| `--yellow-500` | #9c5700 |
| `--yellow-600` | #744000 |
| `--yellow-700` | #4e2a00 |
| `--yellow-800` | #291600 |
| `--yellow-900` | #0e0600 |

### Green (H=160, success)

| Token         | Hex     |
| ------------- | ------- |
| `--green-100` | #d2f1df |
| `--green-200` | #96d5b2 |
| `--green-300` | #3fbf86 |
| `--green-400` | #00a55e |
| `--green-500` | #00883c |
| `--green-600` | #00652b |
| `--green-700` | #00431b |
| `--green-800` | #00240e |
| `--green-900` | #000c03 |

### Neutrals (Radix mauve, perceptually uniform)

| Token          | Hex     |
| -------------- | ------- |
| `--neutral-1`  | #fdfcfd |
| `--neutral-2`  | #faf9fb |
| `--neutral-3`  | #f2eff3 |
| `--neutral-4`  | #eae7ec |
| `--neutral-5`  | #e3dfe6 |
| `--neutral-6`  | #dbd8e0 |
| `--neutral-7`  | #d0cdd7 |
| `--neutral-8`  | #bcbac7 |
| `--neutral-9`  | #8e8c99 |
| `--neutral-10` | #84828e |
| `--neutral-11` | #65636d |
| `--neutral-12` | #211f26 |

### Alpha Scales

| Token              | Value                     |
| ------------------ | ------------------------- |
| `--alpha-white-90` | rgba(255, 255, 255, 0.9)  |
| `--alpha-white-35` | rgba(255, 255, 255, 0.35) |
| `--alpha-white-25` | rgba(255, 255, 255, 0.25) |
| `--alpha-white-15` | rgba(255, 255, 255, 0.15) |
| `--alpha-white-10` | rgba(255, 255, 255, 0.1)  |
| `--alpha-black-75` | rgba(0, 0, 0, 0.75)       |
| `--alpha-black-65` | rgba(0, 0, 0, 0.65)       |
| `--alpha-black-55` | rgba(0, 0, 0, 0.55)       |
| `--alpha-black-45` | rgba(0, 0, 0, 0.45)       |
| `--alpha-black-25` | rgba(0, 0, 0, 0.25)       |
| `--alpha-black-17` | rgba(0, 0, 0, 0.17)       |
| `--alpha-black-10` | rgba(0, 0, 0, 0.1)        |
| `--alpha-black-5`  | rgba(0, 0, 0, 0.05)       |

### Solids

| Token         | Hex     |
| ------------- | ------- |
| `--white`     | #ffffff |
| `--black-600` | #333333 |
| `--black-700` | #222222 |
| `--black-800` | #111111 |
| `--black-900` | #000000 |

## Semantic Token Reference

All semantic tokens are defined in `variables.scss` and can be overridden for theming.

| Token                      | Purpose                | Dark Theme Value   |
| -------------------------- | ---------------------- | ------------------ |
| **Backgrounds**            |                        |                    |
| `--color-bg-app`           | App background         | `--surface-900`    |
| `--color-bg-surface`       | Card/panel background  | `--surface-800`    |
| `--color-bg-elevated`      | Elevated surface       | `--surface-700`    |
| `--color-bg-input`         | Input field background | `--surface-800`    |
| `--color-bg-hover`         | Hover state            | `--alpha-white-10` |
| `--color-bg-node`          | Whiteboard node        | `--alpha-white-10` |
| **Text**                   |                        |                    |
| `--color-text`             | Primary text           | `--neutral-8`      |
| `--color-text-muted`       | Secondary text         | `--neutral-9`      |
| `--color-text-faint`       | Tertiary text          | `--neutral-11`     |
| `--color-text-on-color`    | On colored bg          | `--white`          |
| `--color-text-placeholder` | Placeholder            | `--alpha-white-35` |
| **Borders**                |                        |                    |
| `--color-border`           | Default border         | `--surface-600`    |
| `--color-border-muted`     | Subtle border          | `--surface-700`    |
| `--color-border-focus`     | Focus ring             | `--primary-300`    |
| **Accent**                 |                        |                    |
| `--color-accent`           | Primary accent         | `--primary-500`    |
| `--color-accent-hover`     | Accent hover           | `--primary-400`    |
| `--color-accent-muted`     | Muted accent           | `--primary-600`    |
| `--color-accent-strong`    | Strong accent          | `--primary-300`    |
| **Status**                 |                        |                    |
| `--color-success`          | Success                | `--green-500`      |
| `--color-error`            | Error                  | `--red-500`        |
| `--color-warning`          | Warning                | `--orange-500`     |
| `--color-info`             | Info                   | `--cyan-500`       |
| **Interactive**            |                        |                    |
| `--color-selection`        | Selection              | `--cyan-500`       |
| `--color-link`             | Link color             | `--white`          |

## Domain Token Locations

| Domain          | File                                                                             | Tokens                                                                  |
| --------------- | -------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Jupyter         | `packages/modules/jupyter/src/lib/index.scss`                                    | `--color-kernel`, `--color-kernel-state-*`, `--jp-collaborator-color*`  |
| Chats           | `packages/modules/chats/src/lib/index.scss`                                      | `--color-chat-new`, `--color-chat-default`                              |
| Whiteboard      | `packages/modules/whiteboard/src/lib/components/css/edges.scss`                  | `--color-edge-reference`, `--color-edge-sequence`, `--color-scene`      |
| Collab          | `packages/collab-engine/src/lib/frontend/context.scss`                           | `--color-yjs-awareness-default`                                         |
| Socials         | `packages/modules/socials/src/lib/components/node-video.scss`                    | `--color-youtube`                                                       |
| Containers      | `packages/modules/user-containers/src/lib/index.scss`                            | `--c-led-*`                                                             |
| Users           | `packages/ui-base/src/lib/users/users.scss`                                      | `--c-live-*`, `--c-plus-n-*`, `--c-host-*`, `--c-role-*`, `--c-brand-*` |
| Airtable/Notion | `packages/modules/airtable/src/lib/components/node-airtable/airtable-table.scss` | `--c-status-*`, `--c-highlight-*`, `--c-neutral-*`                      |

## How to Add a New Color

1. **Does a semantic token cover it?** Use it. (e.g., `--color-bg-surface`, `--color-error`)
2. **Is it module-specific?** Add a domain token in the module's SCSS file, referencing a primitive.
3. **Is it a new shade of an existing hue?** Use the nearest primitive (e.g., `--primary-400`).
4. **Is it a genuinely new color?** Discuss with the team. Add to primitives only if justified.

## How to Add a Light Theme

Override semantic tokens in a `[data-theme="light"]` selector:

```scss
[data-theme='light'] {
  --color-bg-app: var(--neutral-1);
  --color-bg-surface: var(--neutral-2);
  --color-bg-elevated: var(--white);
  --color-text: var(--neutral-12);
  --color-text-muted: var(--neutral-11);
  --color-border: var(--neutral-6);
  // ... override all semantic tokens
}
```

Primitives stay the same. Only semantic tokens change.

## Tooling

| Tool            | Command                      | Purpose                                        |
| --------------- | ---------------------------- | ---------------------------------------------- |
| Stylelint       | `npm run stylelint`          | Catches hardcoded values, enforces token usage |
| Token lint      | `npm run lint:tokens`        | Detects unused tokens in `variables.scss`      |
| Enforce charter | `/enforce-charter <package>` | Claude skill to audit a package                |

### Stylelint Rules

- **`scale-unlimited/declaration-strict-value`** — Enforces `var(--...)` for color, font-size, z-index, box-shadow
- **`csstools/value-no-unknown-custom-properties`** — Catches references to undefined custom properties

## Migration from Old Token Names

| Old Pattern                | New Pattern                 |
| -------------------------- | --------------------------- |
| `--c-gray-*` / `--mauve-*` | `--neutral-*`               |
| `--c-pink-*`               | `--primary-*`               |
| `--c-blue-gray-*`          | `--surface-*`               |
| `--c-alt-blue-*`           | `--cyan-*`                  |
| `--c-blue-*`               | `--surface-*` or `--cyan-*` |
| `--c-red-*`                | `--red-*`                   |
| `--c-orange-*`             | `--orange-*`                |
| `--c-yellow-*`             | `--yellow-*`                |
| `--c-green-*`              | `--green-*`                 |
| `--c-white-1`              | `--white`                   |
| `--c-black-*`              | `--black-*`                 |
| `--ca-white-*`             | `--alpha-white-*`           |
| `--ca-black-*`             | `--alpha-black-*`           |
| `--color-background`       | `--color-bg-app`            |
| `--color-node-background`  | `--color-bg-node`           |
| `--color-good`             | `--color-success`           |
| `--color-form-border`      | `--color-border-focus`      |
