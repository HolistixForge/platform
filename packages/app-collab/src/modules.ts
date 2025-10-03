import { ModuleBackend } from '@monorepo/module';

import { moduleBackend as core } from '@monorepo/core-graph';
import { moduleBackend as space } from '@monorepo/space';
import { moduleBackend as chats } from '@monorepo/chats';
import { moduleBackend as gateway } from '@monorepo/gateway';
import { moduleBackend as userContainers } from '@monorepo/user-containers';
import { moduleBackend as jupyter } from '@monorepo/jupyter';
import { moduleBackend as tabs } from '@monorepo/tabs';
import { moduleBackend as notion } from '@monorepo/notion';
import { moduleBackend as socials } from '@monorepo/socials';
import { moduleBackend as airtable } from '@monorepo/airtable';
import { moduleBackend as excalidraw } from '@monorepo/excalidraw';

export const modules: ModuleBackend[] = [
  gateway,
  core,
  space,
  chats,
  userContainers,
  jupyter,
  tabs,
  notion,
  airtable,
  socials,
  excalidraw,
];
