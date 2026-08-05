# Inventaire du Storybook — tout ce qui a existé, et où le ranger

Balayage de **1001 commits, toutes branches**, pour la question : quels éléments
ont été ajoutés au Storybook depuis le début du dépôt, lesquels restent, et
comment les ranger selon la hiérarchie du projet.

Généré pour TAC-180. Les chiffres sont mesurés, pas estimés — la méthode et ses
limites sont en fin de document.

## Les chiffres

|                                                 |                                               |
| ----------------------------------------------- | --------------------------------------------- |
| Fichiers de stories ayant existé                | **269**                                       |
| Présents au HEAD                                | **117**                                       |
| Chemins disparus                                | 152 — dont la plupart sont des **renommages** |
| Éléments réellement perdus, après déduplication | **21**                                        |
| Stories individuelles au HEAD                   | **257**                                       |
| Stories individuelles jamais écrites            | **531**                                       |

La moitié des stories jamais écrites n'existe plus. Mais l'essentiel de cet
écart vient de renommages et de regroupements, pas de suppressions sèches :
seuls 21 éléments n'ont aucun équivalent aujourd'hui.

## La hiérarchie cible

L'ordre canonique est `Views > Components > Resource > Assets`, du plus composé
au plus atomique, appliqué à l'intérieur de chaque groupe :

```
<Groupe>/
├── Views/       l'écran complet
├── Components/  l'assemblage qui connaît une donnée
│   └── Forms/   les formulaires, qui en sont un cas
├── Resource/    l'objet métier rendu
└── Assets/      la brique qui ne sait rien du domaine (bouton, icône, bulle)
```

Quatre groupes : `Base` (ui-base), `Mvp` (ui-views), `Modules/<Nom>`, et `App`
— ce dernier reste à créer, il n'a jamais eu la moindre story.

La distinction `Use/` et `Library/` se pose **au-dessus** de cette arborescence
et n'est pas dans ce document : elle demande le graphe d'imports, pas un
classement manuel. Voir TAC-180.

## Reclassement des 117 stories présentes — appliqué

**Fait.** 97 des 117 `title:` ont été réécrits ; les 20 autres étaient déjà
conformes. Vérifié contre le Storybook en marche (`npm run storybook`,
http://localhost:6006) : **257 stories servies, trois racines** au lieu de
douze — `Base` 107, `Modules` 91, `Mvp` 59.

Les 155 baselines de capture ont été renommées avec, car l'identifiant d'une
story dérive de son titre. Confrontées aux identifiants réellement servis :
**zéro orpheline**. Les 102 stories sans baseline l'étaient déjà.

| avant                                         | après                                                    |
| --------------------------------------------- | -------------------------------------------------------- |
| `Basics/Buttons`                              | `Base/Assets/Buttons`                                    |
| `Basics/Countdown`                            | `Base/Assets/Countdown`                                  |
| `Basics/Datetime`                             | `Base/Assets/Datetime`                                   |
| `Basics/LoadingDots`                          | `Base/Assets/LoadingDots`                                |
| `Basics/Reset`                                | `Base/Assets/CssReset`                                   |
| `Basics/ResourceButtons`                      | `Base/Assets/ResourceButtons`                            |
| `Basics/Tags`                                 | `Base/Assets/Tags`                                       |
| `Credentials/CredentialCard`                  | `Base/Resource/Credentials/CredentialCard`               |
| `Credentials/CredentialForm`                  | `Base/Resource/Credentials/CredentialForm`               |
| `Credentials/CredentialShareDialog`           | `Base/Resource/Credentials/CredentialShareDialog`        |
| `Credentials/CredentialTypeSelector`          | `Base/Resource/Credentials/CredentialTypeSelector`       |
| `Credentials/CredentialsList`                 | `Base/Resource/Credentials/CredentialsList`              |
| `Forms/Account/Login`                         | `Mvp/Components/Forms/Account/Login`                     |
| `Forms/Account/MagicLink`                     | `Mvp/Components/Forms/Account/MagicLink`                 |
| `Forms/Account/NewPassword`                   | `Mvp/Components/Forms/Account/NewPassword`               |
| `Forms/Account/Signup`                        | `Mvp/Components/Forms/Account/Signup`                    |
| `Forms/Account/Totp`                          | `Mvp/Components/Forms/Account/Totp`                      |
| `Forms/Account/TotpLogin`                     | `Mvp/Components/Forms/Account/TotpLogin`                 |
| `Forms/DialogModal`                           | `Base/Components/Forms/DialogModal`                      |
| `Forms/Errors/FormError`                      | `Base/Components/Forms/Errors/FormError`                 |
| `Forms/Errors/FormErrors`                     | `Base/Components/Forms/Errors/FormErrors`                |
| `Forms/Fields/ColorPicker`                    | `Base/Components/Forms/Fields/ColorPicker`               |
| `Forms/Fields/Select`                         | `Base/Components/Forms/Fields/Select`                    |
| `Forms/Fields/Slider`                         | `Base/Components/Forms/Fields/Slider`                    |
| `Forms/Fields/Switch`                         | `Base/Components/Forms/Fields/Switch`                    |
| `Forms/Fields/Text`                           | `Base/Components/Forms/Fields/Text`                      |
| `Forms/Fields/Totp`                           | `Base/Components/Forms/Fields/Totp`                      |
| `Forms/MountVolume`                           | `Mvp/Components/Forms/MountVolume`                       |
| `Forms/NewOrganization`                       | `Mvp/Components/Forms/NewOrganization`                   |
| `Forms/NewProject`                            | `Mvp/Components/Forms/NewProject`                        |
| `Module/Chats/Components/Chat Anchor`         | `Modules/Chats/Components/Chat Anchor`                   |
| `Module/Chats/Components/Chat Box`            | `Modules/Chats/Components/Chat Box`                      |
| `Module/Chats/Components/Discussion Item`     | `Modules/Chats/Components/Discussion Item`               |
| `Module/Chats/Components/Reply Item`          | `Modules/Chats/Components/Reply Item`                    |
| `Module/Chats/Main`                           | `Modules/Chats/Views/Main`                               |
| `Modules/Airtable/Main`                       | `Modules/Airtable/Views/Main`                            |
| `Modules/Excalidraw/Main`                     | `Modules/Excalidraw/Views/Main`                          |
| `Modules/Jupyter/Forms/NewKernel`             | `Modules/Jupyter/Components/Forms/NewKernel`             |
| `Modules/Jupyter/Forms/NewTerminal`           | `Modules/Jupyter/Components/Forms/NewTerminal`           |
| `Modules/Jupyter/Main`                        | `Modules/Jupyter/Views/Main`                             |
| `Modules/Jupyter/Terminal`                    | `Modules/Jupyter/Components/Terminal`                    |
| `Modules/Notion/Main`                         | `Modules/Notion/Views/Main`                              |
| `Modules/Socials/Forms/NewIframe`             | `Modules/Socials/Components/Forms/NewIframe`             |
| `Modules/Socials/Forms/NewNodeUser`           | `Modules/Socials/Components/Forms/NewNodeUser`           |
| `Modules/Socials/Forms/NewYoutube`            | `Modules/Socials/Components/Forms/NewYoutube`            |
| `Modules/Socials/Main`                        | `Modules/Socials/Views/Main`                             |
| `Modules/Space/Components/Cursor`             | `Modules/Whiteboard/Assets/Cursor`                       |
| `Modules/Space/Components/Edges`              | `Modules/Whiteboard/Assets/Edges`                        |
| `Modules/Space/Components/Inputs Outputs`     | `Modules/Whiteboard/Assets/Inputs Outputs`               |
| `Modules/Space/Components/Node Toolbar`       | `Modules/Whiteboard/Assets/Node Toolbar`                 |
| `Modules/Space/Components/Pin`                | `Modules/Whiteboard/Assets/Pin`                          |
| `Modules/Space/Main`                          | `Modules/Whiteboard/Views/Main`                          |
| `Modules/UserContainers/Forms/Docker Options` | `Modules/UserContainers/Components/Forms/Docker Options` |
| `Modules/UserContainers/Forms/NewServer`      | `Modules/UserContainers/Components/Forms/NewServer`      |
| `Modules/UserContainers/Main`                 | `Modules/UserContainers/Views/Main`                      |
| `Mvp/Assets/resource-selection`               | `Mvp/Assets/ResourceSelection`                           |
| `Mvp/Assets/user-bubble`                      | `Base/Assets/UserBubble`                                 |
| `Mvp/Assets/user-display`                     | `Mvp/Assets/UserDisplay`                                 |
| `Mvp/Assets/user-display-item`                | `Mvp/Assets/UserDisplayItem`                             |
| `Mvp/Assets/wrapper`                          | `Mvp/Assets/Wrapper`                                     |
| `Mvp/Components/filter-box`                   | `Mvp/Components/FilterBox`                               |
| `Mvp/Components/header`                       | `Mvp/Components/Header`                                  |
| `Mvp/Components/notebook-card`                | `Mvp/Components/NotebookCard`                            |
| `Mvp/Components/reource-list`                 | `Mvp/Components/ResourceList`                            |
| `Mvp/Components/resource-bar`                 | `Mvp/Components/ResourceBar`                             |
| `Mvp/Components/resource-description`         | `Mvp/Components/ResourceDescription`                     |
| `Mvp/Components/rules`                        | `Mvp/Components/Rules`                                   |
| `Mvp/Components/server-stack`                 | `Mvp/Components/ServerStack`                             |
| `Mvp/Components/summary-accesses`             | `Mvp/Components/SummaryAccesses`                         |
| `Mvp/Components/tabs`                         | `Mvp/Components/Tabs`                                    |
| `Mvp/Components/user-informations`            | `Mvp/Components/UserInformations`                        |
| `Mvp/Components/user-list`                    | `Mvp/Components/UserList`                                |
| `Mvp/Resource/Notebook/notebook-view`         | `Mvp/Resource/Notebook/NotebookView`                     |
| `Mvp/View/access-role`                        | `Mvp/Views/AccessRole`                                   |
| `Mvp/View/accesses`                           | `Mvp/Views/Accesses`                                     |
| `Mvp/View/group-view`                         | `Mvp/Views/GroupView`                                    |
| `Mvp/View/notebook-view`                      | `Mvp/Views/NotebookView`                                 |
| `Mvp/View/server-view`                        | `Mvp/Views/ServerView`                                   |
| `Mvp/View/tag-filter`                         | `Mvp/Views/TagFilter`                                    |
| `Mvp/View/user-view`                          | `Mvp/Views/UserView`                                     |
| `Palette/Default`                             | `Base/Assets/Palette`                                    |
| `UI/LiveSpace`                                | `Base/Components/LiveSpace`                              |
| `UI/Preview`                                  | `Base/Components/Preview`                                |
| `UI/Sidebar`                                  | `Base/Components/Sidebar`                                |
| `Users/IDCard`                                | `Modules/Socials/Components/IDCard`                      |
| `Users/PermissionsPage`                       | `Base/Views/PermissionsPage`                             |
| `Users/PermissionsPage/RolesTab`              | `Base/Views/PermissionsPage/RolesTab`                    |
| `Users/PermissionsPage/UserRoleEditor`        | `Base/Views/PermissionsPage/UserRoleEditor`              |
| `Users/PermissionsPage/UsersTab`              | `Base/Views/PermissionsPage/UsersTab`                    |
| `Users/RoleEditor`                            | `Base/Views/RoleEditor`                                  |
| `Users/UserAvatar`                            | `Base/Assets/UserAvatar`                                 |
| `Users/UserListItem`                          | `Base/Assets/UserListItem`                               |
| `Users/UserUsername`                          | `Base/Assets/UserUsername`                               |
| `icons/all`                                   | `Base/Assets/Icons`                                      |
| `icons/background`                            | `Base/Assets/Background`                                 |
| `internals/Accordion`                         | `Base/Components/Accordion`                              |
| `internals/WrapperCssCoordinates`             | `Base/Components/WrapperCssCoordinates`                  |

## Les 21 éléments perdus

Aucun n'a d'équivalent au HEAD sous le même nom. Ils se répartissent en trois
cas, et seul le premier se restaure tel quel.

### Restaurables — le composant existe encore (5)

Le fichier de story a été supprimé, le composant non. `git show <commit>^:<chemin>`
rend le fichier ; il reste à le remettre au bon étage.

| titre d'époque                         | disparu le | composant, aujourd'hui                                    | étage cible                  |
| -------------------------------------- | ---------- | --------------------------------------------------------- | ---------------------------- |
| `Modules/Jupyter/Cell`                 | 2025-06-17 | `modules/jupyter/…/code-cell/cell.tsx`                    | `Modules/Jupyter/Components` |
| `Modules/Space/Components/Node Header` | 2025-04-04 | `modules/whiteboard/…/assets/node-header/node-header.tsx` | `Modules/Whiteboard/Assets`  |
| `Nodes/Kernel`                         | 2025-02-03 | `modules/jupyter/…/node-kernel/node-kernel.tsx`           | `Modules/Jupyter/Components` |
| `Nodes/Quill`                          | 2025-04-03 | `modules/socials/…/text-editor.tsx`                       | `Modules/Socials/Components` |
| `Nodes/Video`                          | 2025-02-03 | `modules/socials/…/node-video.tsx`                        | `Modules/Socials/Components` |

### Couverts par un renommage — à ne pas restaurer (4)

Le composant a changé de nom et sa story existe déjà sous le nouveau. Les
remettre créerait un doublon.

| titre d'époque                       | ce qui le couvre aujourd'hui                                    |
| ------------------------------------ | --------------------------------------------------------------- |
| `Nodes/Terminal`                     | `Modules/Jupyter/Terminal` (`components/terminal/terminal.tsx`) |
| `Nodes/Chat` · `Nodes/Chat/NodeChat` | `Module/Chats/Components/Chat Anchor` et `Chat Box`             |
| `UI/Tabs`                            | `Modules/Tabs/Components` (`tabs-radix`)                        |

### Composant disparu — à réécrire ou à enterrer (12)

Rien à restaurer : le code qu'ils montraient n'existe plus. À trancher un par
un — certains décrivent une fonctionnalité qu'on veut encore, d'autres sont des
bacs à sable.

| titre d'époque                            | disparu le | quoi                                                            |
| ----------------------------------------- | ---------- | --------------------------------------------------------------- |
| `Mvp/View/servers-create-view`            | 2025-02-03 | l'écran de création de serveur — 3 stories                      |
| `Users/UserRights`                        | 2025-02-05 | l'ancêtre du RBAC, remplacé par `Users/PermissionsPage`         |
| `Forms/CloudInstanceOptions`              | 2025-02-03 | options d'instance cloud — **redevient pertinent avec TAC-129** |
| `Forms/NewVolume` · `Nodes/Volume`        | 2025-02-03 | création et nœud de volume                                      |
| `Forms/NewYoutube`                        | 2025-02-03 | couvert en partie par `Modules/Socials/Forms/NewYoutube`        |
| `Nodes/Jupyter Lab Code Cell`             | 2025-02-03 | cellule de code JupyterLab                                      |
| `Modules/Jupyter/Node Cell`               | 2025-06-17 | nœud de cellule                                                 |
| `Mvp/Assets/warning`                      | 2025-02-03 | l'asset d'avertissement — 3 stories, aucun équivalent           |
| `internals/Node Toolbar`                  | 2025-01-31 | barre d'outils de nœud                                          |
| `Space/Demo` · `Modules/Space/Test Local` | 2025       | bacs à sable, à enterrer                                        |

## Ce que le reclassement corrige au passage

- `Modules/…` (39) et `Module/…` (5) — deux racines pour la même chose
- `Users` et `Users ` (espace final) — deux entrées distinctes dans la sidebar
- les orphelins hors de toute racine : `root`, `internals`, `icons`, `Palette`
- la coquille `Mvp/Components/reource-list`
- `Mvp/Assets/user-bubble` vit dans `ui-base` mais porte un titre `Mvp` — il
  passe à `Base/Assets`, avec ses 16 stories, les plus nombreuses du dépôt
- les titres de démo laissés en place : `a`, `a-b`, `solar system`, `galaxy`,
  `Super title`, `Ceci est une question`

## Méthode, et ce qu'elle ne voit pas

```bash
git log --all --name-only --pretty=format: -- '*.stories.*' '*.mdx'
```

donne tout chemin de story ayant existé sur n'importe quelle branche. Pour
chacun, le contenu est relu à sa dernière révision (`git show <commit>^:<chemin>`)
et le `title:` en est extrait.

Trois limites à connaître avant de se fier aux chiffres :

- **L'identité est le nom de fichier.** Un composant renommé compte comme perdu
  puis retrouvé ; c'est pourquoi les 152 chemins disparus se réduisent à 21
  éléments après déduplication, et pourquoi les quatre « couverts par un
  renommage » ci-dessus ont dû être qualifiés à la main.
- **Le `title:` est celui du fichier, pas de la sidebar.** Storybook autorise un
  titre par story ; aucun fichier n'en use ici, mais rien ne l'empêche.
- **Le comptage de stories est syntaxique** (`^export const`). Il inclut les
  constantes exportées qui ne sont pas des stories. Écart mesuré faible, non nul.

## Les 97 qui n'ont jamais eu de story — jamais, dans aucun commit

L'inventaire ci-dessus répond à « qu'est-ce qui a existé puis disparu ». La
question voisine — « qu'est-ce qui aurait pu être là et ne l'a jamais été » —
donne un chiffre plus grand, et c'est celui qui compte pour la suite.

Sur **199 composants au HEAD**, 137 noms ont eu une story à un moment de
l'histoire du dépôt. **97 n'en ont jamais eu aucune.** Ce ne sont pas des
pertes : ce sont des absences d'origine.

| groupe                    | jamais racontés |
| ------------------------- | --------------- |
| `Modules/whiteboard`      | **23**          |
| `App`                     | **21**          |
| `Modules/airtable`        | **11**          |
| `Modules/notion`          | **9**           |
| `Base`                    | **5**           |
| `Modules/jupyter`         | **4**           |
| `frontend-data`           | **4**           |
| `Modules/excalidraw`      | **3**           |
| `Modules/socials`         | **3**           |
| `Modules/user-containers` | **3**           |
| `Modules/chats`           | **2**           |
| `Mvp`                     | **2**           |
| `Modules/collab`          | **1**           |
| `Modules/module`          | **1**           |
| `Modules/n8n`             | **1**           |
| `Modules/pgadmin4`        | **1**           |
| `Modules/reducers`        | **1**           |
| `Modules/tabs`            | **1**           |
| `ui-toolkit`              | **1**           |

Trois foyers portent l'essentiel :

- **`Modules/whiteboard` — 22.** Le module le plus gros du dépôt, et celui dont
  le Storybook ne montre que les briques (`cursor`, `edges`, `slot`). Ni les
  panneaux, ni les groupes, ni les enveloppes de nœuds.
- **`App` — 21.** Aucune story n'a jamais existé pour l'application elle-même.
  13 sont des écrans routés.
- **`Modules/airtable` et `Modules/notion` — 18 à eux deux.** Deux modules
  entiers réduits à leur story `Main`.

Le détail, rangé selon la hiérarchie cible :

### `App/Components`

- `app-frontend/src/app/MobileBlockOverlay.tsx`
- `app-frontend/src/app/app.tsx`
- `app-frontend/src/app/header/header-logic.tsx`

### `App/Components/Forms`

- `app-frontend/src/app/forms/login-form.tsx`
- `app-frontend/src/app/forms/new-project-form.tsx`
- `app-frontend/src/app/forms/password.tsx`
- `app-frontend/src/app/forms/signup-form.tsx`
- `app-frontend/src/app/forms/totp-form.tsx`

### `App/Views`

- `app-frontend/src/app/pages/account.tsx`
- `app-frontend/src/app/pages/credentials.tsx`
- `app-frontend/src/app/pages/home.tsx`
- `app-frontend/src/app/pages/organization/dashboard.tsx`
- `app-frontend/src/app/pages/organization/organization-context.tsx`
- `app-frontend/src/app/pages/project/editor/editor-page.tsx`
- `app-frontend/src/app/pages/project/editor/node-editor/node-editor-view.tsx`
- `app-frontend/src/app/pages/project/editor/resources-page.tsx`
- `app-frontend/src/app/pages/project/gateway-countdown.tsx`
- `app-frontend/src/app/pages/project/project-loading.tsx`
- `app-frontend/src/app/pages/project/project-root.tsx`
- `app-frontend/src/app/pages/project/project-wrapper.tsx`
- `app-frontend/src/app/pages/project/sidebar.tsx`

### `Base/Components`

- `ui-base/src/lib/buttons/buttonBase.tsx`
- `ui-base/src/lib/buttons/buttonIcon.tsx`
- `ui-base/src/lib/storybook-utils.tsx`
- `ui-base/src/lib/users/users.tsx`
- `ui-base/src/lib/utils/click-stop-propagation.tsx`

### `Modules/airtable/Components`

- `modules/airtable/src/lib/airtable-menu.tsx`
- `modules/airtable/src/lib/components/node-airtable/AirtableRecordCard.tsx`
- `modules/airtable/src/lib/components/node-airtable/airtable-base-table-list.tsx`
- `modules/airtable/src/lib/components/node-airtable/airtable-table-gallery.tsx`
- `modules/airtable/src/lib/components/node-airtable/airtable-table-kanban.tsx`
- `modules/airtable/src/lib/components/node-airtable/airtable-table-list.tsx`
- `modules/airtable/src/lib/components/node-airtable/node-airtable-kanban-column.tsx`
- `modules/airtable/src/lib/components/node-airtable/node-airtable-record.tsx`
- `modules/airtable/src/lib/components/node-airtable/node-airtable-table.tsx`
- `modules/airtable/src/lib/components/node-airtable/right-panel.tsx`

### `Modules/airtable/Components/Forms`

- `modules/airtable/src/lib/components/forms/new-base.tsx`

### `Modules/chats/Components`

- `modules/chats/src/lib/components/node-chat/chatbox-logic.tsx`
- `modules/chats/src/lib/components/node-chat/node-chatbox.tsx`

### `Modules/collab/Components`

- `modules/collab/src/lib/collab-project-context.tsx`

### `Modules/excalidraw/Components`

- `modules/excalidraw/src/lib/excalidraw-menu.tsx`
- `modules/excalidraw/src/lib/excalidraw-node.tsx`
- `modules/excalidraw/src/lib/layer.tsx`

### `Modules/jupyter/Components`

- `modules/jupyter/src/lib/components/code-editor-monaco/code-editor-monaco-lazy.tsx`
- `modules/jupyter/src/lib/components/node-kernel/kernel-state-indicator.tsx`
- `modules/jupyter/src/lib/jupyter-menu.tsx`
- `modules/jupyter/src/lib/stories/module-stories-utils.tsx`

### `Modules/module/Components`

- `modules/module/src/lib/module-hooks.tsx`

### `Modules/n8n/Components`

- `modules/n8n/src/lib/n8n.tsx`

### `Modules/notion/Components`

- `modules/notion/src/lib/components/node-notion/node-notion-database.tsx`
- `modules/notion/src/lib/components/node-notion/node-notion-kanban-column.tsx`
- `modules/notion/src/lib/components/node-notion/node-notion-task.tsx`
- `modules/notion/src/lib/components/node-notion/notion-database-gallery.tsx`
- `modules/notion/src/lib/components/node-notion/notion-database-kanban.tsx`
- `modules/notion/src/lib/components/node-notion/notion-database-list.tsx`
- `modules/notion/src/lib/components/node-notion/notion-property-renderer.tsx`
- `modules/notion/src/lib/notion-menu.tsx`

### `Modules/notion/Components/Forms`

- `modules/notion/src/lib/components/forms/new-database.tsx`

### `Modules/pgadmin4/Components`

- `modules/pgadmin4/src/lib/pgadmin4.tsx`

### `Modules/reducers/Components`

- `modules/reducers/src/lib/reducers-hooks.tsx`

### `Modules/socials/Components`

- `modules/socials/src/lib/components/node-iframe.tsx`
- `modules/socials/src/lib/components/node-reservation.tsx`
- `modules/socials/src/lib/socials-menu.tsx`

### `Modules/tabs/Components`

- `modules/tabs/src/lib/components/tabs-radix-logic.tsx`

### `Modules/user-containers/Components`

- `modules/user-containers/src/lib/local-runner-frontend.tsx`
- `modules/user-containers/src/lib/platform-runner-frontend.tsx`
- `modules/user-containers/src/lib/servers-menu.tsx`

### `Modules/whiteboard/Assets`

- `modules/whiteboard/src/lib/components/assets/edges/edge-menu.tsx`

### `Modules/whiteboard/Components`

- `modules/whiteboard/src/lib/components/ModeIndicator.tsx`
- `modules/whiteboard/src/lib/components/apis/avatarStore.tsx`
- `modules/whiteboard/src/lib/components/avatar.tsx`
- `modules/whiteboard/src/lib/components/avatarsRenderer.tsx`
- `modules/whiteboard/src/lib/components/contextual-menu.tsx`
- `modules/whiteboard/src/lib/components/group/group.tsx`
- `modules/whiteboard/src/lib/components/htmlAvatarStore.tsx`
- `modules/whiteboard/src/lib/components/layer-context.tsx`
- `modules/whiteboard/src/lib/components/node-wrappers/disable-zoom-drag-pan.tsx`
- `modules/whiteboard/src/lib/components/node-wrappers/left-right-inputs-outputs.tsx`
- `modules/whiteboard/src/lib/components/node-wrappers/node-wrapper.tsx`
- `modules/whiteboard/src/lib/components/node-wrappers/selection-awareness.tsx`
- `modules/whiteboard/src/lib/components/node.tsx`
- `modules/whiteboard/src/lib/components/panels/layers-tree-panel.tsx`
- `modules/whiteboard/src/lib/components/reactflow-layer-context.tsx`
- `modules/whiteboard/src/lib/components/reactflow-layer.tsx`
- `modules/whiteboard/src/lib/components/right-panels.tsx`
- `modules/whiteboard/src/lib/components/shape/shape.tsx`
- `modules/whiteboard/src/lib/components/whiteboard.tsx`
- `modules/whiteboard/src/lib/stories/story-context-mocks.tsx`
- `modules/whiteboard/src/lib/stories/story-whiteboard.tsx`
- `modules/whiteboard/src/lib/whiteboard-menu.tsx`

### `Mvp/Components/Forms`

- `ui-views/src/lib/form/form-totp/totp.tsx`

### `Mvp/Views`

- `ui-views/src/lib/mvp-ui-view/view/server-view.tsx`

### `frontend-data/Components`

- `frontend-data/src/lib/api-context.tsx`
- `frontend-data/src/lib/contexts/project-context.tsx`
- `frontend-data/src/lib/modules/module-data-provider.tsx`
- `frontend-data/src/lib/story-api-context.tsx`

### `ui-toolkit/Components`

- `ui-toolkit/src/lib/jwt/jwt.tsx`

## Portée du balayage — ce qu'il couvre, ce qu'il ne couvre pas

Vérifié plutôt que supposé, parce qu'un inventaire dont on ignore les angles
morts ne vaut pas mieux qu'une estimation.

`git log --all` couvre ici **416 références** : 394 checkpoints Conductor, 10
branches locales, 10 distantes, 2 tags. C'est large — les checkpoints en
particulier retiennent des états qu'aucune branche ne référence plus.

Restent dehors, et mesurés :

- **3 commits** visibles seulement dans le reflog. Vérifiés un par un : aucun
  ne touche un fichier de story.
- **0 stash.**
- **Aucune autre convention de nommage.** Pas de `.story.`, pas de MDX orphelin,
  rien sous un `stories/` qui serait une story sans en porter l'extension — les
  fichiers qui s'y trouvent (`story-whiteboard.tsx`, `mockSpace.tsx`,
  `graphs-data/`) sont des harnais et des fixtures, pas des entrées de sidebar.

Ce que le balayage ne peut pas voir : un commit jamais écrit sur ce clone.
Si un ancien dépôt a précédé celui-ci — `demiurge-ui-components` a été renommé
`ui-base` en février 2025, ce qui suggère une vie antérieure — son histoire
propre n'est pas ici.
