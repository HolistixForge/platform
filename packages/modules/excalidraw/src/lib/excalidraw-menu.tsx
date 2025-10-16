import { FrontendDispatcher } from '@monorepo/reducers/frontend';
import { TSpaceMenuEntries } from '@monorepo/space/frontend';
import { TGraphNode, TEventNewNode } from '@monorepo/core-graph';
import { makeUuid } from '@monorepo/simple-types';
import { TEventDisableFeature } from '@monorepo/space';

export const excalidrawMenuEntries: TSpaceMenuEntries = ({
  viewId,
  position,
  dispatcher,
}) => {
  const d = dispatcher as FrontendDispatcher<
    TEventNewNode | TEventDisableFeature
  >;

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

            // Disable grouping and move-node features for Excalidraw nodes
            d.dispatch({
              type: 'space:disable-feature',
              viewId: viewId,
              nid: nodeId,
              feature: 'grouping',
            });

            d.dispatch({
              type: 'space:disable-feature',
              viewId: viewId,
              nid: nodeId,
              feature: 'frontend-move-node',
            });
          },
        },
      ],
    },
  ];
};
