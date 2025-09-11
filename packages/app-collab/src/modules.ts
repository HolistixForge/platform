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
import { moduleBackend as airtable } from '@monorepo/airtable';
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
  {
    collabChunk: {
      name: 'config',
      loadExtraContext: () => ({
        config: {
          NOTION_API_KEY: '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',
          AIRTABLE_API_KEY: 'patHY43dqtZMM1GRK.e55234d4a6f95714796d381be083cdc4e08eb54baebfd322424148ae268a8e06'
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
  airtable,
  socials,
];
