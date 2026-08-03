# Storybook & Visual Regression

How the Storybook setup works in this monorepo, and how to keep it healthy.

## Table of Contents

1. [Layout](#layout)
2. [Running a Storybook](#running-a-storybook)
3. [Writing a Story](#writing-a-story)
4. [Visual Regression Suite](#visual-regression-suite)
5. [Screenshot Baselines](#screenshot-baselines)
6. [Excluding a Story from the Screenshot Suite](#excluding-a-story-from-the-screenshot-suite)
7. [Troubleshooting](#troubleshooting)

---

## Layout

Eleven packages ship their own Storybook. Each one has a `.storybook/` directory
and a `tsconfig.storybook.json`:

| Package                            | Scope                    |
| ---------------------------------- | ------------------------ |
| `packages/ui-base`                 | Design system primitives |
| `packages/ui-views`                | Composed views and forms |
| `packages/modules/airtable`        | Module                   |
| `packages/modules/chats`           | Module                   |
| `packages/modules/excalidraw`      | Module                   |
| `packages/modules/jupyter`         | Module                   |
| `packages/modules/notion`          | Module                   |
| `packages/modules/socials`         | Module                   |
| `packages/modules/tabs`            | Module                   |
| `packages/modules/user-containers` | Module                   |
| `packages/modules/whiteboard`      | Module                   |

Targets are inferred by the `@nx/storybook` plugin (see `nx.json`), so there is
no per-package target to declare:

| Target            | What it does                           |
| ----------------- | -------------------------------------- |
| `storybook`       | Serves the Storybook in dev mode       |
| `build-storybook` | Builds a static Storybook              |
| `test-storybook`  | Runs the screenshot / smoke test suite |

The `.storybook/` contents are intentionally uniform across packages:

- `main.ts` — stories glob + `addon-essentials` and `addon-interactions`
- `preview.ts` — dark background, global decorator, design-system stylesheet
- `global-wrapper.tsx` — the decorator itself
- `test-runner.js` — screenshot capture and comparison

Keep them aligned. Divergence between packages is how this setup rots.

---

## Running a Storybook

```bash
npx nx run @holistix-forge/ui-base:storybook          # dev server
npx nx run @holistix-forge/ui-base:build-storybook    # static build
```

---

## Writing a Story

Stories live next to the component: `my-component.tsx` →
`my-component.stories.tsx`. Every exported component in a package's public API
should have one.

```tsx
import type { Meta, StoryObj } from '@storybook/react';
import { MyComponent } from './my-component';

const meta = {
  title: 'Basics/MyComponent',
  component: MyComponent,
  parameters: { layout: 'centered' },
} satisfies Meta<typeof MyComponent>;

export default meta;
type Story = StoryObj<typeof MyComponent>;

export const Normal: Story = { args: { label: 'Hello' } };
```

**Every story is screenshotted.** That has two consequences:

- **Fixtures must be deterministic.** No `Math.random()`, no `Date.now()`, no
  generated ids or colors, no remote avatars. Put shared fixtures in a
  `*-mocks.ts` next to the stories (see
  `packages/ui-base/src/lib/credentials/credentials-mocks.ts`).
- **`satisfies Meta<typeof X>` requires the props type to be exported** from the
  component module, otherwise `tsc` raises `TS4023`.

---

## Visual Regression Suite

`.storybook/test-runner.js` visits every story, waits for fonts and layout to
settle, disables CSS animations, then screenshots `#storybook-root` and compares
it against a committed baseline (`jest-image-snapshot`, 0.2% pixel tolerance).

Run it for one package:

```bash
npx nx run @holistix-forge/ui-base:build-storybook
npx http-server packages/ui-base/storybook-static -p 6006 --silent &
npx test-storybook --url http://127.0.0.1:6006 --config-dir packages/ui-base/.storybook
```

Or across the workspace:

```bash
npm run test:visual          # compare
npm run test:visual:update   # regenerate baselines
```

In CI the `visual-regression` job (`.github/workflows/ci.yml`) runs the same
thing on `ubuntu-24.04`. It is **non-blocking**: on a difference it uploads the
diff images as an artifact and posts a PR comment, it does not fail the build.

---

## Screenshot Baselines

Baselines live in `packages/**/__screenshots__/` and **are committed**. Diff
output lands in `__diff_output__/`, which is gitignored.

> **Baselines are platform-specific.** They are generated on Linux, matching the
> `ubuntu-24.04` CI runner. Regenerating them on a macOS host produces images
> that differ on font rasterization alone — same layout, same colors, different
> antialiasing — and every story then reports a 3-6% diff in CI.
>
> Regenerate baselines **inside the Linux dev container or from CI**, never from
> a macOS host.

When you add stories from a macOS host, leave the baselines out of the commit.
CI will report the missing snapshots in its PR comment, and the baselines can be
generated in one pass on Linux:

```bash
npx nx run <package>:test-storybook -- -u
```

---

## Excluding a Story from the Screenshot Suite

Some stories cannot be captured deterministically — a live countdown, a
progress animation, anything driven by the wall clock. Tag them:

```tsx
export const Running: Story = {
  tags: ['no-visual-test'],
  render: () => <Countdown targetDate={new Date(Date.now() + 60_000)} />,
};
```

`.storybook/test-runner.js` declares `tags: { skip: ['no-visual-test'] }`, so
those stories still show up in Storybook but are skipped by the screenshot
comparison. Use it sparingly — prefer making the fixture deterministic.

---

## Troubleshooting

**`unknown variant 'es2023', expected one of ... es2022`**

`@swc/jest` targets `es2023` on Node ≥ 18; `@swc/core` must be recent enough to
understand it. The whole suite fails to start ("Test suite failed to run") when
they drift apart. Keep `@swc/core` current in the root `package.json`.

**`Executable doesn't exist at .../headless_shell`**

```bash
npx playwright install chromium
npx playwright install-deps chromium   # Linux only
```

**`build-storybook` hangs with `--parallel=3`**

Each Storybook build is memory-hungry. Lower the parallelism, or raise the heap:

```bash
NODE_OPTIONS=--max_old_space_size=4096 npx nx run-many -t build-storybook --parallel=2
```

**`npm run lint` reports thousands of errors after building Storybook**

`storybook-static/` is an ESLint-ignored build artefact (`eslint.config.cjs`).
If you see this, the ignore entry is missing — do not lint generated bundles.

---

## Related

- [Testing Guide](TESTING_GUIDE.md)
- [Module Testing with Storybook](MODULES_TESTING.md)
- [Style System](STYLE_SYSTEM.md)
