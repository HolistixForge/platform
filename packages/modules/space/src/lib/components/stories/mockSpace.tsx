import { ReactNode, useMemo } from 'react';

import {
  SharedTypes,
  TCollaborativeChunk,
  TValidSharedData,
  MockCollaborativeContext,
  useShareDataManager,
} from '@monorepo/collab-engine';
import { CoreReducer, Core_loadData, TCoreSharedData } from '@monorepo/core';

import {
  SpaceContext,
  TSpaceContext,
} from '../reactflow-renderer/spaceContext';
import { TNodeContext } from '../apis/types/node';
import { SpaceReducer } from '../../space-reducer';
import { Space_loadData, TSpaceSharedData } from '../../space-shared-model';
import { CollabSpaceState } from '../collab-module/collab-space-state';
import { loadStoryData, STORY_VIEW_ID } from './graphs-data/loader';
import { WhiteboardMode } from '../reactflow-renderer/demiurge-space';

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

export const MockSpace = ({
  children,
  selected,
  isOpened = true,
}: {
  children: ReactNode;
  selected?: boolean;
  isOpened?: boolean;
}) => {
  //

  return (
    <MockCollaborativeContext collabChunks={chunks}>
      <MockSpaceContext>
        <MockSpaceBackground />
        <MockReactFlowNodeWrapper
          selected={selected || false}
          isOpened={isOpened}
        >
          {children}
        </MockReactFlowNodeWrapper>
      </MockSpaceContext>
    </MockCollaborativeContext>
  );
};

//

const MockSpaceContext = ({ children }: { children: ReactNode }) => {
  const sdm = useShareDataManager<TSpaceSharedData & TCoreSharedData>();

  const context: TSpaceContext = useMemo(() => {
    return {
      spaceState: new CollabSpaceState(STORY_VIEW_ID, sdm),
      currentUser: { username: 'toto', color: '#ffa500' },
      mode: 'default' as WhiteboardMode,
      viewId: STORY_VIEW_ID,
      edgeMenu: null,
      setEdgeMenu: () => {},
      resetEdgeMenu: () => {},
    };
  }, []);

  // useRegisterListener(context.spaceState);

  return <SpaceContext value={{ ...context }}>{children}</SpaceContext>;
};

//

export const MockSpaceBackground = () => (
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
);

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
