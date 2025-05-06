import { ReactNode, useMemo } from 'react';

import {
  CollaborativeContext,
  Dispatcher,
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedData,
  useAwareness,
  useSharedData,
} from '@monorepo/collab-engine';
import { CoreReducer, Core_loadData } from '@monorepo/core';

import { SpaceContext } from '../reactflow-renderer/spaceContext';
import { TNodeContext } from '../apis/types/node';
import { SpaceReducer } from '../../space-reducer';
import { Space_loadData } from '../../space-shared-model';
import { CollabSpaceAwareness } from '../collab-module/collab-space-awareness';
import { CollabSpaceState } from '../collab-module/collab-space-state';
import { loadStoryData, STORY_VIEW_ID } from './graphs-data/loader';

//

const chunks: TCollaborativeChunk[] = [
  {
    sharedData: (st: SharedTypes) => Core_loadData(st),
    reducers: (sd: TValidSharedData) => [new CoreReducer()],
  },
  {
    sharedData: (st: SharedTypes) => {
      const sd = Space_loadData(st);
      return sd;
    },
    reducers: (sd: TValidSharedData) => [new SpaceReducer()],
    extraContext: (sd: TValidSharedData) => {
      loadStoryData(sd as any);
      return {};
    },
  },
];

//

export const MockReactFlowNodeWrapper = ({
  children,
  selected,
  isOpened,
}: Pick<TNodeContext, 'selected' | 'isOpened'> & {
  children: ReactNode;
}) => {
  return (
    <div
      className={`react-flow__node-wrapper node-${
        isOpened ? 'opened' : 'closed'
      } ${selected ? 'selected' : ''}`}
    >
      {children}
    </div>
  );
};

//

export const StoryMockSpaceContext = ({
  children,
  selected,
  isOpened = true,
}: {
  children: ReactNode;
  selected?: boolean;
  isOpened?: boolean;
}) => {
  //

  const dispatcher = useMemo(() => {
    return new Dispatcher();
  }, []);

  // useRegisterListener(context.spaceState);

  return (
    <CollaborativeContext
      id={'story'}
      collabChunks={chunks}
      config={{
        type: 'none',
        simulateUsers: true,
      }}
      dispatcher={dispatcher}
      user={{
        username: 'John Doe',
        color: '#ffa500',
      }}
    >
      <div>
        <MockSpaceContext>
          <div>
            <svg
              className="react-flow__background"
              style={{
                position: 'absolute',
                width: '100%',
                height: '100%',
                top: '0px',
                left: '0px',
              }}
              data-testid="rf__background"
            >
              <pattern
                id="pattern-1undefined"
                x="0"
                y="0"
                width="20"
                height="20"
                patternUnits="userSpaceOnUse"
                patternTransform="translate(-0.5,-0.5)"
              >
                <circle cx="0.5" cy="0.5" r="0.5" fill="#91919a"></circle>
              </pattern>
              <rect
                x="0"
                y="0"
                width="100%"
                height="100%"
                fill="url(#pattern-1undefined)"
              ></rect>
            </svg>

            <MockReactFlowNodeWrapper
              selected={selected || false}
              isOpened={isOpened}
            >
              {children}
            </MockReactFlowNodeWrapper>
          </div>
        </MockSpaceContext>
      </div>
    </CollaborativeContext>
  );
};

//

const MockSpaceContext = ({ children }: { children: ReactNode }) => {
  const { awareness } = useAwareness();
  const sd = useSharedData(['graphViews'], (sd) => sd);

  const context = useMemo(() => {
    return {
      spaceAwareness: new CollabSpaceAwareness(STORY_VIEW_ID, awareness),
      spaceState: new CollabSpaceState(STORY_VIEW_ID, sd),
      currentUser: { username: 'toto', color: '#ffa500' },
      moveNodeMode: false,
      viewId: STORY_VIEW_ID,
    };
  }, []);

  return <SpaceContext value={{ ...context }}>{children}</SpaceContext>;
};
