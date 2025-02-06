import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TChat } from './chats-types';

export type TChatSharedData = {
  chats: SharedMap<TChat>;
};

export const Chat_loadData = (st: SharedTypes): TChatSharedData => {
  return {
    chats: st.getSharedMap<TChat>('plugin-chats'),
  };
};
