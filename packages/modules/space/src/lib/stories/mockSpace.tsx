import { ReactNode, useMemo } from 'react';

import {
  MockCollaborativeContext,
  TCollaborationContext,
  TCollaborativeChunk,
  useShareDataManager,
} from '@monorepo/collab-engine';
import {
  TCoreSharedData,
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';

import { SpaceContext, TSpaceContext } from '../components/spaceContext';
import { TNodeContext } from '../components/apis/types/node';
import { TSpaceSharedData } from '../space-shared-model';
import { CollabSpaceState } from '../components/collab-space-state';
import { STORY_VIEW_ID } from './story-space';
import { WhiteboardMode } from '../components/holistix-space';

import { moduleBackend as spaceBackend } from '../../';
import { moduleFrontend as spaceFrontend } from '../../frontend';

//

const frontChunks: TCollaborativeChunk[] = [
  coreFrontend.collabChunk,
  spaceFrontend.collabChunk,
];

const backChunks: TCollaborativeChunk[] = [
  {
    name: 'gateway',
  },
  coreBackend.collabChunk,
  spaceBackend.collabChunk,
];

export const MockSpace = ({
  children,
  selected,
  isOpened = true,
  callback,
}: {
  children: ReactNode;
  selected?: boolean;
  isOpened?: boolean;
  callback?: (context: TCollaborationContext) => void;
}) => {
  //

  return (
    <MockCollaborativeContext
      frontChunks={frontChunks}
      backChunks={backChunks}
      getRequestContext={() => ({})}
      callback={callback}
    >
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
