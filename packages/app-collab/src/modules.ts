import { ModuleBackend } from '@monorepo/module';

import { moduleBackend as core } from '@monorepo/core';
import { moduleBackend as space } from '@monorepo/space';
import { moduleBackend as chats } from '@monorepo/chats';
import {
  moduleBackend as servers,
  TGanymedeExtraContext,
  TGatewayExtraContext,
} from '@monorepo/servers';
import { moduleBackend as jupyter } from '@monorepo/jupyter';
import { moduleBackend as tabs } from '@monorepo/tabs';
import { moduleBackend as notion } from '@monorepo/notion';
import { moduleBackend as socials } from '@monorepo/socials';
import { toGanymede } from './build-collab';
import { runScript } from './run-script';
import { CONFIG } from './config';

export const modules: ModuleBackend[] = [
  {
    collabChunk: {
      name: 'gateway',
      loadExtraContext: (): TGatewayExtraContext => ({
        gateway: {
          updateReverseProxy: async (
            services: { location: string; ip: string; port: number }[]
          ) => {
            const config = services
              .map((s) => `${s.location} ${s.ip} ${s.port}\n`)
              .join('');
            runScript('update-nginx-locations', config);
          },
          gatewayFQDN: CONFIG.GATEWAY_FQDN,
        },
      }),
    },
  },
  {
    collabChunk: {
      name: 'ganymede',
      loadExtraContext: (): TGanymedeExtraContext => ({
        ganymede: {
          toGanymede,
        },
      }),
    },
  },
  core,
  space,
  chats,
  servers,
  jupyter,
  tabs,
  notion,
  socials,
];
