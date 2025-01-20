# demiurge-ui-components

This repo is included as a subtree in a monorepo.

Dependencies list and version must be kept matching those in the monorepo.

## run storybook in standalone repo

```shell
$ npm run storybook
```

## run storybook inside monorepo

```shell
$ npx nx run demiurge-ui-components:storybook
```

## make chromatic build

```shell
npm install
npx chromatic --project-token=chpt_9c737e1aef9738b -zip
```
