import { ModuleFrontend } from '@monorepo/module/frontend';

import { moduleFrontend as core } from '@monorepo/core';
import { moduleFrontend as space } from '@monorepo/space/frontend';
import { moduleFrontend as chats } from '@monorepo/chats/frontend';
import { moduleFrontend as servers } from '@monorepo/servers/frontend';
import { moduleFrontend as jupyter } from '@monorepo/jupyter/frontend';
import { moduleFrontend as tabs } from '@monorepo/tabs';
import { moduleFrontend as notion } from '@monorepo/notion/frontend';
import { moduleFrontend as socials } from '@monorepo/socials/frontend';

export const modules: ModuleFrontend[] = [
  core,
  space,
  chats,
  servers,
  jupyter,
  tabs,
  notion,
  socials,
];
