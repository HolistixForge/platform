import { TModule } from '@monorepo/module';
import { moduleFrontend as collabFrontend } from '@monorepo/collab/frontend';
import { moduleFrontend as reducersFrontend } from '@monorepo/reducers/frontend';
import { moduleFrontend as coreFrontend } from '@monorepo/core-graph';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { moduleFrontend as tabsFrontend } from '@monorepo/tabs';
import { moduleFrontend as userContainersFrontend } from '@monorepo/user-containers/frontend';
import { moduleFrontend as notionFrontend } from '@monorepo/notion/frontend';
import { moduleFrontend as airtableFrontend } from '@monorepo/airtable/frontend';
import { moduleFrontend as jupyterFrontend } from '@monorepo/jupyter/frontend';
import { moduleFrontend as excalidrawFrontend } from '@monorepo/excalidraw/frontend';
import { moduleFrontend as socialsFrontend } from '@monorepo/socials/frontend';
import { moduleFrontend as chatsFrontend } from '@monorepo/chats/frontend';

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: {},
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: tabsFrontend, config: {} },
  { module: userContainersFrontend, config: {} },
  { module: notionFrontend, config: {} },
  { module: airtableFrontend, config: {} },
  { module: jupyterFrontend, config: {} },
  { module: excalidrawFrontend, config: {} },
  { module: socialsFrontend, config: {} },
  { module: chatsFrontend, config: {} },
  { module: tabsFrontend, config: {} },
];
