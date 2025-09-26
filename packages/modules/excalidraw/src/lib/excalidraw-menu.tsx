import { FrontendDispatcher } from '@monorepo/collab-engine';
import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import { TGraphNode } from '@monorepo/module';
import { TEventNewNode } from '@monorepo/core';
import { makeUuid } from '@monorepo/simple-types';

export const excalidrawMenuEntries: TSpaceMenuEntries = ({
  viewId,
  position,
  dispatcher,
}) => {
  const d = dispatcher as FrontendDispatcher<TEventNewNode>;

  return [
    {
      type: 'sub-menu',
      label: 'Excalidraw',
      entries: [
        {
          type: 'item',
          label: 'New Excalidraw Drawing',
          onClick: () => {
            const nodeId = makeUuid();
            const node: TGraphNode = {
              id: nodeId,
              name: 'ExcalidrawNode',
              root: true,
              connectors: [],
              type: 'ExcalidrawNode',
              data: {},
            };

            d.dispatch({
              type: 'core:new-node',
              nodeData: node,
              edges: [],
              origin: {
                viewId: viewId,
                position: position(),
              },
            });
          },
        },
      ],
    },
  ];
};
