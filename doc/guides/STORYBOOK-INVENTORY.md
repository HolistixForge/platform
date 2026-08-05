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

## Reclassement des 117 stories présentes

**82 sur 117 changent d'étage.** Colonne de gauche : le `title:` d'aujourd'hui.
Colonne du milieu : où il va.

| aujourd'hui                                          | cible                                                    | stories |
| ---------------------------------------------------- | -------------------------------------------------------- | ------- |
| `Basics/Buttons`                                     | `Base/Assets/button`                                     | 1       |
| `Basics/Countdown`                                   | `Base/Assets/countdown`                                  | 2       |
| `Basics/Datetime`                                    | `Base/Assets/datetime`                                   | 5       |
| `Basics/LoadingDots`                                 | `Base/Assets/loading-dots`                               | 2       |
| `Basics/Reset`                                       | `Base/Assets/reset`                                      | 1       |
| `Basics/ResourceButtons`                             | `Base/Assets/resource-buttons`                           | 1       |
| `Basics/Tags`                                        | `Base/Assets/tags`                                       | 4       |
| `Credentials/CredentialCard`                         | `Base/Resource/Credentials/CredentialCard`               | 4       |
| `Credentials/CredentialForm`                         | `Base/Resource/Credentials/CredentialForm`               | 3       |
| `Credentials/CredentialShareDialog`                  | `Base/Resource/Credentials/CredentialShareDialog`        | 3       |
| `Credentials/CredentialTypeSelector`                 | `Base/Resource/Credentials/CredentialTypeSelector`       | 4       |
| `Credentials/CredentialsList`                        | `Base/Resource/Credentials/CredentialsList`              | 3       |
| `Forms/Account/Login`                                | `Mvp/Components/Forms/login`                             | 1       |
| `Forms/Account/MagicLink`                            | `Mvp/Components/Forms/magic-link`                        | 2       |
| `Forms/Account/NewPassword`                          | `Mvp/Components/Forms/new-password`                      | 1       |
| `Forms/Account/Signup`                               | `Mvp/Components/Forms/signup`                            | 1       |
| `Forms/Account/Totp`                                 | `Mvp/Components/Forms/totp-setup`                        | 2       |
| `Forms/Account/TotpLogin`                            | `Mvp/Components/Forms/totp-login`                        | 1       |
| `Forms/DialogModal`                                  | `Base/Components/Forms/dialog`                           | 1       |
| `Forms/Errors/FormError`                             | `Base/Components/Forms/form-error`                       | 1       |
| `Forms/Errors/FormErrors`                            | `Base/Components/Forms/form-errors`                      | 1       |
| `Forms/Fields/ColorPicker`                           | `Base/Components/Forms/color-picker`                     | 2       |
| `Forms/Fields/Select`                                | `Base/Components/Forms/select-fieldset`                  | 1       |
| `Forms/Fields/Slider`                                | `Base/Components/Forms/slider-fieldset`                  | 5       |
| `Forms/Fields/Switch`                                | `Base/Components/Forms/switch-fieldset`                  | 2       |
| `Forms/Fields/Text`                                  | `Base/Components/Forms/text-fieldset`                    | 5       |
| `Forms/Fields/Totp`                                  | `Base/Components/Forms/totp-fieldset`                    | 1       |
| `Forms/MountVolume`                                  | `Mvp/Components/Forms/mount-volume`                      | 1       |
| `Forms/NewOrganization`                              | `Mvp/Components/Forms/new-organization`                  | 2       |
| `Forms/NewProject`                                   | `Mvp/Components/Forms/new-project`                       | 1       |
| `Module/Chats/Components/Chat Anchor`                | `Modules/Chats/Components/node-chat-anchor`              | 6       |
| `Module/Chats/Components/Chat Box`                   | `Modules/Chats/Components/chatbox`                       | 6       |
| `Module/Chats/Components/Discussion Item`            | `Modules/Chats/Components/discussionItem`                | 1       |
| `Module/Chats/Components/Reply Item`                 | `Modules/Chats/Components/replyItem`                     | 1       |
| `Module/Chats/Main`                                  | `Modules/Chats/Views/module`                             | 1       |
| `Modules/Airtable/Main`                              | `Modules/Airtable/Views/airtable-module`                 | 1       |
| `Modules/Excalidraw/Main`                            | `Modules/Excalidraw/Views/excalidraw-module`             | 1       |
| `Modules/Jupyter/Components/Card Settings`           | `Modules/Jupyter/Components/card-settings`               | 1       |
| `Modules/Jupyter/Components/Cells Hive`              | `Modules/Jupyter/Components/cells-hive`                  | 1       |
| `Modules/Jupyter/Components/Code Editor`             | `Modules/Jupyter/Components/code-editor-monaco`          | 1       |
| `Modules/Jupyter/Components/Control Bar`             | `Modules/Jupyter/Components/control-bar`                 | 1       |
| `Modules/Jupyter/Components/Display Menu`            | `Modules/Jupyter/Components/display-menu`                | 1       |
| `Modules/Jupyter/Components/Hive Tag`                | `Modules/Jupyter/Components/hive-tag`                    | 1       |
| `Modules/Jupyter/Components/MenuExpanded`            | `Modules/Jupyter/Components/menuExpanded`                | 4       |
| `Modules/Jupyter/Components/Node Dataset`            | `Modules/Jupyter/Components/node-dataset`                | 3       |
| `Modules/Jupyter/Components/Node Notebook`           | `Modules/Jupyter/Components/node-notebook`               | 3       |
| `Modules/Jupyter/Components/Node Notebook Component` | `Modules/Jupyter/Components/node-notebook-component`     | 3       |
| `Modules/Jupyter/Components/Node Python`             | `Modules/Jupyter/Components/node-python`                 | 3       |
| `Modules/Jupyter/Components/Node Screening`          | `Modules/Jupyter/Components/node-screening`              | 3       |
| `Modules/Jupyter/Components/Node Vault`              | `Modules/Jupyter/Components/node-vault`                  | 3       |
| `Modules/Jupyter/Components/Reduced Cells`           | `Modules/Jupyter/Components/reduced-cell`                | 6       |
| `Modules/Jupyter/Components/Tag`                     | `Modules/Jupyter/Components/tag`                         | 3       |
| `Modules/Jupyter/Forms/NewKernel`                    | `Modules/Jupyter/Components/Forms/new-kernel`            | 1       |
| `Modules/Jupyter/Forms/NewTerminal`                  | `Modules/Jupyter/Components/Forms/new-terminal`          | 1       |
| `Modules/Jupyter/Main`                               | `Modules/Jupyter/Views/jupyter-module`                   | 1       |
| `Modules/Jupyter/Terminal`                           | `Modules/Jupyter/Components/terminal`                    | 1       |
| `Modules/Notion/Components/NotionDatabase`           | `Modules/Notion/Components/notion-database`              | 1       |
| `Modules/Notion/Main`                                | `Modules/Notion/Views/notion-module`                     | 1       |
| `Modules/Socials/Forms/NewIframe`                    | `Modules/Socials/Components/Forms/form-new-iframe`       | 1       |
| `Modules/Socials/Forms/NewNodeUser`                  | `Modules/Socials/Components/Forms/form-new-node-user`    | 1       |
| `Modules/Socials/Forms/NewYoutube`                   | `Modules/Socials/Components/Forms/form-new-youtube`      | 1       |
| `Modules/Socials/Main`                               | `Modules/Socials/Views/socials`                          | 1       |
| `Modules/Space/Components/Cursor`                    | `Modules/Whiteboard/Assets/Cursor`                       | 1       |
| `Modules/Space/Components/Edges`                     | `Modules/Whiteboard/Assets/edge`                         | 1       |
| `Modules/Space/Components/Inputs Outputs`            | `Modules/Whiteboard/Assets/inputsOutputs`                | 4       |
| `Modules/Space/Components/Node Toolbar`              | `Modules/Whiteboard/Assets/node-main-toolbar`            | 1       |
| `Modules/Space/Components/Pin`                       | `Modules/Whiteboard/Assets/Slot`                         | 1       |
| `Modules/Space/Main`                                 | `Modules/Whiteboard/Views/space-module`                  | 1       |
| `Modules/UserContainers/Components/Led`              | `Modules/UserContainers/Components/status-led`           | 3       |
| `Modules/UserContainers/Components/Node Server`      | `Modules/UserContainers/Components/node-server`          | 3       |
| `Modules/UserContainers/Components/Server Card`      | `Modules/UserContainers/Components/server-card`          | 7       |
| `Modules/UserContainers/Forms/Docker Options`        | `Modules/UserContainers/Components/Forms/docker-options` | 1       |
| `Modules/UserContainers/Forms/NewServer`             | `Modules/UserContainers/Components/Forms/new-server`     | 1       |
| `Modules/UserContainers/Main`                        | `Modules/UserContainers/Views/user-containers-module`    | 1       |
| `Mvp/Assets/resource-selection`                      | `Mvp/Assets/resource-selection`                          | 2       |
| `Mvp/Assets/user-bubble`                             | `Base/Assets/user-bubble`                                | 16      |
| `Mvp/Assets/user-display`                            | `Mvp/Assets/user-display`                                | 1       |
| `Mvp/Assets/user-display-item`                       | `Mvp/Assets/user-display-item`                           | 1       |
| `Mvp/Assets/wrapper`                                 | `Mvp/Assets/wrapper`                                     | 2       |
| `Mvp/Components/filter-box`                          | `Mvp/Components/filter-box`                              | 2       |
| `Mvp/Components/header`                              | `Mvp/Components/header`                                  | 4       |
| `Mvp/Components/notebook-card`                       | `Mvp/Components/notebook-card`                           | 7       |
| `Mvp/Components/reource-list`                        | `Mvp/Components/resource-list`                           | 1       |
| `Mvp/Components/resource-bar`                        | `Mvp/Components/resource-bar`                            | 1       |
| `Mvp/Components/resource-description`                | `Mvp/Components/resource-description`                    | 2       |
| `Mvp/Components/rules`                               | `Mvp/Components/rules`                                   | 2       |
| `Mvp/Components/server-stack`                        | `Mvp/Components/server-stack`                            | 2       |
| `Mvp/Components/summary-accesses`                    | `Mvp/Components/summary-accesses`                        | 3       |
| `Mvp/Components/tabs`                                | `Mvp/Components/tabs`                                    | 1       |
| `Mvp/Components/user-informations`                   | `Mvp/Components/user-informations`                       | 2       |
| `Mvp/Components/user-list`                           | `Mvp/Components/user-list`                               | 1       |
| `Mvp/Resource/Notebook/notebook-view`                | `Mvp/Resource/notebook-view`                             | 4       |
| `Mvp/View/access-role`                               | `Mvp/Views/access-role`                                  | 1       |
| `Mvp/View/accesses`                                  | `Mvp/Views/accesses`                                     | 1       |
| `Mvp/View/group-view`                                | `Mvp/Views/group-view`                                   | 1       |
| `Mvp/View/notebook-view`                             | `Mvp/Views/notebook-view`                                | 2       |
| `Mvp/View/server-view`                               | `Mvp/Views/servers-view`                                 | 1       |
| `Mvp/View/tag-filter`                                | `Mvp/Views/tag-filter`                                   | 1       |
| `Mvp/View/user-view`                                 | `Mvp/Views/user-view`                                    | 2       |
| `Palette/Default`                                    | `Base/Assets/palette`                                    | 1       |
| `UI/LiveSpace`                                       | `Base/Components/liveSpace`                              | 1       |
| `UI/Preview`                                         | `Base/Components/Preview`                                | 1       |
| `UI/Sidebar`                                         | `Base/Components/Sidebar`                                | 1       |
| `Users/IDCard`                                       | `Modules/Socials/Components/node-id-card`                | 1       |
| `Users/PermissionsPage`                              | `Base/Views/permissions-page`                            | 4       |
| `Users/PermissionsPage/RolesTab`                     | `Base/Views/roles-tab`                                   | 3       |
| `Users/PermissionsPage/UserRoleEditor`               | `Base/Views/user-role-editor`                            | 5       |
| `Users/PermissionsPage/UsersTab`                     | `Base/Views/users-tab`                                   | 4       |
| `Users/RoleEditor`                                   | `Base/Views/role-editor`                                 | 2       |
| `Users/UserAvatar`                                   | `Base/Assets/users-avatar`                               | 4       |
| `Users/UserListItem`                                 | `Base/Assets/user-list-item`                             | 3       |
| `Users/UserUsername`                                 | `Base/Assets/users-username`                             | 5       |
| `icons/all`                                          | `Base/Assets/icons`                                      | 1       |
| `icons/background`                                   | `Base/Assets/background`                                 | 1       |
| `internals/Accordion`                                | `Base/Components/Accordion`                              | 2       |
| `internals/WrapperCssCoordinates`                    | `Base/Components/wrapper-css-coordinates`                | 1       |
| `root`                                               | `Modules/Tabs/Components/tabs-radix`                     | 1       |

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
