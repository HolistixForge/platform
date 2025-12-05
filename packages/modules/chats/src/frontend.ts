import './lib/index.scss';
import { NodeChatbox } from './lib/components/node-chat/node-chatbox';
import { NodeChatAnchor } from './lib/components/node-chat-anchor/node-chat-anchor';
import type { TModule } from '@holistix-forge/module';
import type { TCollabFrontendExports } from '@holistix-forge/collab/frontend';
import type { TSpaceFrontendExports } from '@holistix-forge/whiteboard/frontend';

type TRequired = {
  collab: TCollabFrontendExports;
  space: TSpaceFrontendExports;
};

export const moduleFrontend: TModule<TRequired> = {
  name: 'chats',
  version: '0.0.1',
  description: 'Chats module',
  dependencies: ['core-graph', 'collab', 'space'],
  load: ({ depsExports }) => {
    depsExports.collab.collab.loadSharedData('map', 'chats', 'chats');

    depsExports.space.registerMenuEntries(
      ({ dispatcher, from, position, viewId }) => [
        {
          type: 'sub-menu',
          label: 'Chats',
          entries: [
            {
              type: 'item',
              label: 'New Chat',
              onClick: () => {
                dispatcher.dispatch({
                  type: 'chats:new-chat',
                  origin: {
                    viewId: viewId,
                    position: position(),
                  },
                });
              },
              disabled: from !== undefined,
            },
          ],
        },
      ]
    );

    depsExports.space.registerNodes({
      chat: NodeChatbox,
      'chat-anchor': NodeChatAnchor,
    });
  },
};
