# Graphic Charter Enforcement

Audit and fix graphic charter violations for the package: **$ARGUMENTS**

## Style System Architecture

The design system uses a **3-layer token architecture**:

1. **Primitives** (`variables.scss`) — OKLCH-derived shade scales. Components rarely reference these directly.
2. **Semantic tokens** (`variables.scss`) — Purpose-based names (`--color-bg-app`, `--color-text`, `--color-error`). **This is what components use.**
3. **Domain tokens** (package SCSS files) — Module-specific colors defined in the package that owns them.

### Which layer to use?

| Situation                                 | Layer     | Example                                        |
| ----------------------------------------- | --------- | ---------------------------------------------- |
| Standard background, text, border         | Semantic  | `var(--color-bg-surface)`, `var(--color-text)` |
| Status indication                         | Semantic  | `var(--color-error)`, `var(--color-success)`   |
| Module-specific color (kernel, chat, LED) | Domain    | `var(--color-kernel)`, `var(--c-led-blue)`     |
| Building a new semantic/domain token      | Primitive | `var(--primary-500)`, `var(--surface-800)`     |

## Token Reference

Design tokens are defined in `packages/ui-base/src/lib/assets/css/variables.scss`.
Domain tokens are in each package's SCSS files (see `doc/guides/STYLE_SYSTEM.md`).

### Color Tokens — Primitives

| Scale                         | Shades    | Role                    |
| ----------------------------- | --------- | ----------------------- |
| `--primary-100..900`          | 9 shades  | Brand purple/magenta    |
| `--surface-100..900`          | 9 shades  | Dark theme surfaces     |
| `--cyan-100..900`             | 9 shades  | Data/interactive accent |
| `--red-100..900`              | 9 shades  | Error/danger            |
| `--orange-100..900`           | 9 shades  | Warning                 |
| `--yellow-100..900`           | 9 shades  | Debug/info              |
| `--green-100..900`            | 9 shades  | Success                 |
| `--neutral-1..12`             | 12 shades | Grays (Radix mauve)     |
| `--alpha-white-*`             | 5 values  | White transparency      |
| `--alpha-black-*`             | 8 values  | Black transparency      |
| `--white`, `--black-600..900` | 5 values  | Solids                  |

### Color Tokens — Semantic

| Token                      | Purpose                     |
| -------------------------- | --------------------------- |
| `--color-bg-app`           | App background              |
| `--color-bg-surface`       | Surface/card background     |
| `--color-bg-elevated`      | Elevated surface            |
| `--color-bg-input`         | Input background            |
| `--color-bg-hover`         | Hover state background      |
| `--color-bg-node`          | Whiteboard node background  |
| `--color-text`             | Primary text                |
| `--color-text-muted`       | Secondary text              |
| `--color-text-faint`       | Tertiary text               |
| `--color-text-on-color`    | Text on colored backgrounds |
| `--color-text-placeholder` | Placeholder text            |
| `--color-border`           | Default border              |
| `--color-border-muted`     | Subtle border               |
| `--color-border-focus`     | Focus ring / form border    |
| `--color-accent`           | Primary accent              |
| `--color-accent-hover`     | Accent hover state          |
| `--color-accent-muted`     | Muted accent                |
| `--color-accent-strong`    | Strong accent               |
| `--color-success`          | Success state               |
| `--color-error`            | Error state                 |
| `--color-warning`          | Warning state               |
| `--color-info`             | Info state                  |
| `--color-selection`        | Selection highlight         |
| `--color-link`             | Link color                  |
| `--color-debug`            | Debug overlay               |
| `--color-button-blue`      | Blue button accent          |
| `--color-vault`            | Vault/sensitive indicator   |

### Font Size Tokens

| Hardcoded | Token                  |
| --------- | ---------------------- |
| 9px       | `var(--font-size-2xs)` |
| 11px      | `var(--font-size-xs)`  |
| 12px      | `var(--font-size-sm)`  |
| 13px-14px | `var(--font-size-md)`  |
| 15px-16px | `var(--font-size-lg)`  |
| 17px-18px | `var(--font-size-xl)`  |
| 20px-21px | `var(--font-size-2xl)` |
| 24px-25px | `var(--font-size-3xl)` |
| 28px-30px | `var(--font-size-4xl)` |

### Shadow Tokens

| Hardcoded Pattern   | Token              |
| ------------------- | ------------------ |
| Small/subtle shadow | `var(--shadow-sm)` |
| Medium shadow       | `var(--shadow-md)` |
| Large shadow        | `var(--shadow-lg)` |
| Extra-large shadow  | `var(--shadow-xl)` |

### Z-Index Tokens

| Hardcoded Range | Token               |
| --------------- | ------------------- |
| 0-10            | `var(--z-base)`     |
| 50-150          | `var(--z-dropdown)` |
| 150-250         | `var(--z-sticky)`   |
| 250-350         | `var(--z-modal)`    |
| 350-450         | `var(--z-tooltip)`  |
| 450+            | `var(--z-toast)`    |

### Spacing Tokens

| Value | Token               |
| ----- | ------------------- |
| 0px   | `var(--spacing-0)`  |
| 2px   | `var(--spacing-1)`  |
| 4px   | `var(--spacing-2)`  |
| 6px   | `var(--spacing-3)`  |
| 8px   | `var(--spacing-4)`  |
| 12px  | `var(--spacing-5)`  |
| 16px  | `var(--spacing-6)`  |
| 20px  | `var(--spacing-7)`  |
| 24px  | `var(--spacing-8)`  |
| 32px  | `var(--spacing-10)` |
| 40px  | `var(--spacing-12)` |
| 48px  | `var(--spacing-14)` |
| 64px  | `var(--spacing-16)` |

## Workflow

1. **Audit** the package for violations:

   - Search all `.scss` and `.css` files in `packages/$ARGUMENTS/` for hardcoded hex colors, font-size values, z-index values, and box-shadow values
   - Search all `.tsx` and `.ts` files for inline `style={{}}` props with hardcoded color/font-size/z-index/shadow values
   - Check for references to old token names (`--c-gray-*`, `--c-pink-*`, `--c-blue-gray-*`, `--c-alt-blue-*`, `--ca-white-*`, `--ca-black-*`, `--c-white-1`, `--c-black-*`, `--mauve-*`)
   - Count violations by category

2. **Fix** violations:

   - Replace hardcoded values with the closest matching token
   - For colors: prefer semantic tokens first, then domain tokens, then primitives
   - For font-size: use the mapping table above
   - For z-index: use the layer that matches the component's purpose
   - For box-shadow: use the closest shadow token
   - For inline styles in TSX: prefer SCSS class-based approaches where possible
   - For old token names: use the mapping in `doc/guides/STYLE_SYSTEM.md`

3. **Validate** fixes:

   - Run `npx nx run $ARGUMENTS:lint`
   - Run `npx nx run $ARGUMENTS:typecheck`
   - Run `npx nx run $ARGUMENTS:test` (if tests exist)
   - Run `npm run lint:tokens` to check for undefined/unused variables
   - Fix any errors introduced

4. **Report** results:
   - List files changed
   - Count violations fixed per category
   - List any remaining violations that need manual review

## Important Notes

- `variables.scss` and `utilities.scss` are EXCLUDED from enforcement — they define the raw values
- Third-party library styles are excluded
- Some values are legitimate exceptions (e.g., CSS calculations, SVG-specific values, animation keyframes, conic-gradient colors)
- All values must map to a token — no `/* charter-exception */` needed if the color is genuinely unique (use a `/* charter-exception: <reason> */` comment only for truly one-off values)
- Domain tokens belong in their package's SCSS file, not in `variables.scss`
