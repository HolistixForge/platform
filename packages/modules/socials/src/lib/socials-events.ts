import { TEventOrigin } from '@monorepo/core';

export type TEventNewYoutube = {
  type: 'socials:new-youtube';
  videoId: string;
  origin?: TEventOrigin;
};

export type TEventNewTextEditor = {
  type: 'socials:new-text-editor';
  origin?: TEventOrigin;
};

export type TEventDeleteYoutube = {
  type: 'socials:delete-youtube';
  nodeId: string;
};

export type TEventSocials =
  | TEventNewYoutube
  | TEventDeleteYoutube
  | TEventNewTextEditor;
