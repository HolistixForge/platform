import { ReactNode } from 'react';
import { MockSpace } from './mockSpace';
import { TCoreSharedData } from '@monorepo/core';
import { TSpaceSharedData } from '../space-shared-model';
import { STORY_VIEW_ID } from './story-space';

export const STORY_NODE_ID = 'node-1';

export const StoryNode = ({
  children,
  selected,
  isOpened,
}: {
  children: ReactNode;
  selected: boolean;
  isOpened: boolean;
}) => {
  return (
    <MockSpace
      selected={selected}
      isOpened={isOpened}
      callback={({ sharedData, sharedTypes }) => {
        sharedTypes.transaction(async () => {
          (sharedData as TCoreSharedData).nodes.set(STORY_NODE_ID, {
            root: true,
            id: STORY_NODE_ID,
            name: STORY_NODE_ID,
            type: 'dataset',
            connectors: [
              {
                connectorName: 'outputs',
                pins: [
                  {
                    id: 'output-1',
                    pinName: 'output-1',
                  },
                  {
                    id: 'output-2',
                    pinName: 'output-2',
                  },
                ],
              },
              {
                connectorName: 'inputs',
                pins: [
                  {
                    id: 'inputs-1',
                    pinName: 'inputs-1',
                  },
                  {
                    id: 'inputs-2',
                    pinName: 'inputs-2',
                  },
                ],
              },
            ],
          });

          (sharedData as TSpaceSharedData).graphViews.set(STORY_VIEW_ID, {
            graph: {
              nodes: [],
              edges: [],
            },
            nodeViews: [],
            edges: [],
            params: {
              maxRank: 0,
              roots: [],
            },
            connectorViews: {},
          });
        });
      }}
    >
      {children}
    </MockSpace>
  );
};
