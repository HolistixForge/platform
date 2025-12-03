import { SharedMap } from '@holistix/collab-engine';
import { TChat } from './chats-types';

export type TChatSharedData = {
  'chats:chats': SharedMap<TChat>;
};
