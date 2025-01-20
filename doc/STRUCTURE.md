# subtree

[packages/demiurge-ui-components](./packages/demiurge-ui-components/README.md) is a git subtree

```shell
# it has been set up as follow
git remote add demiurge-ui-components-origin git@github.com:DemiurgeGalaxie/demiurge-ui-components.git
# check: git remote -v
git subtree add --prefix=packages/demiurge-ui-components demiurge-ui-components-origin main
```

to push/pull modifications

```shell
git subtree push --prefix=packages/demiurge-ui-components demiurge-ui-components-origin main
git fetch demiurge-ui-components-origin main
git subtree pull --squash --prefix=packages/demiurge-ui-components demiurge-ui-components-origin main

# TODO false conflicts: try git merge -s subtree -Xsubtree="packages/demiurge-ui-components" demiurge-ui-components-origin/main --allow-unrelated-histories
git subtree pull --squash --prefix=packages/demiurge-ui-components demiurge-ui-components-origin main

# if fucked up
git merge --abort
tar --exclude='plearnt/node_modules' --exclude='plearnt/.git' --exclude='plearnt/.nx' --exclude='plearnt/dist' -zcvf plearnt.tgz plearnt
```
