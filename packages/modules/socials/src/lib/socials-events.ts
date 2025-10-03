import { TEventOrigin } from '@monorepo/core-graph';

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

export type TEventNewNodeUser = {
  type: 'socials:new-node-user';
  userId: string;
  origin?: TEventOrigin;
};

export type TEventDeleteNodeUser = {
  type: 'socials:delete-node-user';
  nodeId: string;
};

export type TEventNewReservation = {
  type: 'socials:new-reservation';
  userId?: string;
  origin?: TEventOrigin;
};

export type TEventDeleteReservation = {
  type: 'socials:delete-reservation';
  nodeId: string;
};

export type TEventSocials =
  | TEventNewYoutube
  | TEventDeleteYoutube
  | TEventNewTextEditor
  | TEventDeleteTextEditor
  | TEventNewIframe
  | TEventDeleteIframe
  | TEventNewNodeUser
  | TEventDeleteNodeUser
  | TEventNewReservation
  | TEventDeleteReservation;
