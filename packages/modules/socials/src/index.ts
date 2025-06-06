import { SocialsReducer } from './lib/socials-reducer';
import type { ModuleBackend } from '@monorepo/module';

export const moduleBackend: ModuleBackend = {
  collabChunk: {
    name: 'socials',
    loadReducers: (sd) => [new SocialsReducer()],
  },
};

export type { TEventSocials } from './lib/socials-events';
