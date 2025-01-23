import { SharedMap, SharedTypes } from '@monorepo/collab-engine';
import { TChat } from '@monorepo/demiurge-types';

export type TChatSharedData = {
  chats: SharedMap<TChat>;
};

export const Chat_loadData = (st: SharedTypes): TChatSharedData => {
  return {
    chats: st.getSharedMap<TChat>('chat_chats'),
  };
};
