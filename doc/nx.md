# NX app and lib generators

```
npx create-nx-workspace
cd monorepo
```

## React lib

```
npm install --save-dev @nx/react
npm install --save-dev @nx/storybook
npx nx g @nx/react:lib packages/{LIB_NAME} --linter eslint --bundler vite --style scss --unitTestRunner jest
npx nx g @nx/react:storybook-configuration {LIB_NAME}
```

```
npm install -D sass-embedded
npx nx run {LIB_NAME}:storybook

npm install -D sass
npx nx run {LIB_NAME}:build
```

## node lib

```
npm install -D @nx/node
npx nx g @nx/node:lib packages/{LIB_NAME} --buildable --linter eslint --unitTestRunner jest
npx nx run {LIB_NAME}:build
```

add compilerOptions in {LIB_NAME}/tsconfig.lib.json

```json
{
  "compilerOptions": {
    "module": "ESNext", // Change from default (CommonJS) to ES module output
    "target": "ES2022", // Ensure compatibility with ES modules
    "moduleResolution": "Node", // Use Node-style resolution for ES modules
    "esModuleInterop": true, // Ensure compatibility with CommonJS modules
    "allowSyntheticDefaultImports": true, // Allow default imports from CommonJS modules
    "importHelpers": true // Optimize output by using tslib
  }
}
```

## app node

```
npx nx g @nx/node:app  packages/app-node1 --linter eslint --e2eTestRunner jest --framework none ----unitTestRunner jest
```

add in packages/{APP_NAME}/package.json

```json
{
  "nx": {
    "targets": {
      "build": {
        "options": {
          "bundle": true,
          "thirdParty": true
        }
      }
    }
  }
}
```

## tailwind

```
npm install -D tailwindcss autoprefixer
```

### create tailwind.config.js, postcss.config.js

```
# in monorepo root
npx tailwindcss init -p
```

edit tailwind.config.js

```javascript
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  plugins: [],
};
```

edit postcss.config.js

```javascript
const { join } = require('path');

module.exports = {
  plugins: {
    tailwindcss: {
      config: join(__dirname, 'tailwind.config.js'),
    },
    autoprefixer: {},
  },
};
```

### setup storybook

.storybook/preview.ts

```typescript
import type { Preview } from '@storybook/react';
import { GlobalWrapper } from './global-wrapper';

import '../src/lib/index.scss';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: '#222',
        },
      ],
    },
  },
  decorators: [GlobalWrapper],
  tags: [],
};

export default preview;
```

.storybook/global-wrapper.tsx

```typescript
// add common wrapper, mock context etc in this component
export const GlobalWrapper = (Story: any) => <Story />;
```

src/lib/index.scss

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

## svg

## json

## Others Actions

### Rename lib

```shell
nx g @nrwl/workspace:mv --project ganymede-types --destination demiurge-types
```

### Delete remove

```shell
nx g remove three-flow
```

### Update everything

```
upgrade nodejs
# remove package.json: overrides: {}
npm install -g npm@latest
nx migrate latest
nx migrate --run-migrations
npm install --global npm-check-updates@latest
npm-check-updates
npm install xxxxx@X.Y.Z
npm audit
# package.json: overrides: {}
```

### Run NX monorepo jest tests

```shell
npx nx run-many --all --target=test --parallel
```
