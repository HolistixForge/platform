import { FrontendDispatcher } from '@holistix/reducers/frontend';
import { TSpaceMenuEntries } from '@holistix/space/frontend';
import { TGraphNode, TEventNewNode } from '@holistix/core-graph';
import { makeUuid } from '@holistix/shared-types';
import { TEventDisableFeature } from '@holistix/space';

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
          onClick: async () => {
            const nodeId = makeUuid();
            const node: TGraphNode = {
              id: nodeId,
              name: 'ExcalidrawNode',
              root: true,
              connectors: [],
              type: 'ExcalidrawNode',
              data: {},
            };

            await d.dispatch({
              type: 'core:new-node',
              nodeData: node,
              edges: [],
              origin: {
                viewId: viewId,
                position: position(),
              },
            });

            // Disable grouping and move-node features for Excalidraw nodes
            await d.dispatch({
              type: 'space:disable-feature',
              viewId: viewId,
              nid: nodeId,
              feature: 'grouping',
            });

            await d.dispatch({
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
