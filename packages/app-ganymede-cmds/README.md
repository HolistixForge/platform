
# App Ganymede Commands

A command line app to manage ganymede

(in Ganymede container)

# Build

```shell
$ npx nx run app-ganymede-cmds:build:production
```

# Run

```shell
$ DEVELOPMENT=false LOG_LEVEL=6 node dist/packages/app-ganymede-cmds/main.js add-gateway -h gwX.dev-XXX.demiurge.co -gv 0.0.2
```