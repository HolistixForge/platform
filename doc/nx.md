# NX How to

```shell
npx create-nx-workspace
cd monorepo
```

## React lib

```shell
npm install --save-dev @nx/react
npx nx g @nx/react:lib packages/{LIB_NAME} --linter eslint --bundler vite --style scss --unitTestRunner jest
npx nx run {LIB_NAME}:build
```

in vite.config.js, set all dependencies external:

```js
    rollupOptions: {
      external: (id) => !id.startsWith('.') && !id.startsWith('/'),
    },
```

## node lib

```shell
npm install -D @nx/node
npx nx g @nx/node:lib packages/{LIB_NAME} --buildable --linter eslint --unitTestRunner jest
npx nx run {LIB_NAME}:build
```

add compilerOptions in {LIB_NAME}/tsconfig.lib.json

```json
{
  "compilerOptions": {
    "module": "ESNext", // Change from default (CommonJS) to ES module output
    "moduleResolution": "Node" // Use Node-style resolution for ES modules
  }
}
```

## react app

```shell
npx nx g @nx/react:app packages/{APP_NAME} --style scss --bundler vite --linter eslint
npx nx run {APP_NAME}:build
npx nx run {APP_NAME}:serve
```

## node app

```shell
npx nx g @nx/node:app  packages/{APP_NAME} --linter eslint --e2eTestRunner jest --framework none --unitTestRunner jest
```

In packages/_{APP_NAME}_/**package.json** :

- (optional) set **bundle** to true and **thirdParty** to true
- set react and react-dom as **external** to not bundle them when importing a lib that use jsx
- set **runBuildTargetDependencies** in **serve** target to force recompilation on file changes

In packages/_{APP_NAME}_/**tsconfig.app.json** :

remove :

```json
{
  "compilerOptions": {
    "module": "nodenext",
    "moduleResolution": "nodenext"
  }
}
```

if necessary, in package.json

```
"external": [
    "react",
    "react-dom",
    "*.css",
    "*.svg",
    "*.woff",
    "*.woff2",
    "*.eot",
    "*.ttf",
    "*.otf"
  ],
  ...
  "esbuildOptions": {
    "sourcemap": true,
    "outExtension": {
      ".js": ".js"
    },
    "loader": {
      ".css": "empty",
      ".svg": "empty",
      ".woff": "empty",
      ".woff2": "empty",
      ".eot": "empty",
      ".ttf": "empty",
      ".otf": "empty"
    }
  }
```

### app node ESM

Rename all .ts file to .mts

Use **.mjs** extension in relative local import

In packages/_{APP_NAME}_/**package.json** :

- add type: **module**
- change **outExtension** from .js to **.mjs**
- change main path from **.ts** to **.mts**

```json
{
  "type": "module",
  "nx": {
    "targets": {
      "build": {
        "options": {
          "format": ["esm"],
          "bundle": true,
          "thirdParty": true,
          "external": ["react", "react-dom"],
          "main": "packages/app-node-1/src/main.mts",
          "esbuildOptions": {
            "outExtension": {
              ".js": ".mjs"
            }
          }
        },
        "configurations": {
          "production": {
            "esbuildOptions": {
              "outExtension": {
                ".js": ".mjs"
              }
            }
          }
        }
      },
      "serve": {
        "options": {
          "runBuildTargetDependencies": true
        }
      }
    }
  }
}
```

In packages/_{APP_NAME}_/**tsconfig.app.json** : Add **.mts** to **include** array

```json
{
  "include": ["src/**/*.ts", "src/**/*.mts"]
}
```

## storybook

```shell
npm install --save-dev @nx/storybook
npx nx g @nx/react:storybook-configuration {LIB_NAME}
```

add nodePolyfills in vite.config.ts

## tailwind

```
npm install -D tailwindcss@3.4.17 autoprefixer postcss
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

Create a scss file that import tailwind styles

packages/_{LIB_NAME}_/src/lib/**index.scss** :

```css
@tailwind base;
@tailwind components;
@tailwind utilities;
```

Import it from **index.ts**

packages/_{LIB_NAME}_/src/**index.ts** :

```typescript
import './lib/index.scss';

// ...
// export { ... } from ...
```

In package.json, declare style and export the resulting compiled css file

packages/_{LIB_NAME}_/**package.json** :

```json
{
  "style": "./dist/style.css",
  "exports": {
    "./style": "./dist/style.css"
  }
}
```

In the app using the react lib, import the lib styles

packages/_{APP_NAME}_/src/**main.tsx** :

```typescript
import '@monorepo/{LIB_NAME}/style';
```

### setup storybook

If necessary, create a storybook global wrapper for adding contexts and mock

packages/_{LIB_NAME}_/.storybook/**global-wrapper.tsx** :

```typescript
// add common wrapper, mock context etc in this component
export const GlobalWrapper = (Story: any) => <Story />;
```

Import the **index.scss** (containing tailwind styles) file from **preview.ts**

packages/_{LIB_NAME}_/.storybook/**preview.ts** :

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

## json

add **"resolveJsonModule": true** in compilerOptions on **tsconfig.app.json** or **tsconfig.lib.json**

```json
{
  "compilerOptions": {
    "resolveJsonModule": true
  },
  "files": [
    "src/app/oas30.json",
    "src/app/exec-pipes.json",
    "src/app/data-connections.json",
    "src/app/sql-api-pg.json"
  ],
  "include": ["src/**/*.ts"]
}
```

## Others Actions

### build all

````shell
npx nx run-many -t build
```

### Rename lib

```shell
nx g @nrwl/workspace:mv --project ganymede-types --destination demiurge-types
````

### Delete remove

```shell
nx g remove three-flow
```

### Update everything

```shell
# upgrade nodejs
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
