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

export type TEventDeleteTextEditor = {
  type: 'socials:delete-text-editor';
  nodeId: string;
};

export type TEventDeleteYoutube = {
  type: 'socials:delete-youtube';
  nodeId: string;
};

export type TEventNewIframe = {
  type: 'socials:new-iframe';
  src: string;
  origin?: TEventOrigin;
};

export type TEventDeleteIframe = {
  type: 'socials:delete-iframe';
  nodeId: string;
};

export type TEventSocials =
  | TEventNewYoutube
  | TEventDeleteYoutube
  | TEventNewTextEditor
  | TEventDeleteTextEditor
  | TEventNewIframe
  | TEventDeleteIframe;
