import { ReactNode, useMemo } from 'react';

import { TCoreSharedData, TGraphNode } from '@monorepo/core-graph';
import { FrontendDispatcher } from '@monorepo/reducers/frontend';
import { SharedTypes } from '@monorepo/collab-engine';

import {
  ReactflowLayerContext,
  TSpaceContext,
} from '../components/reactflow-layer-context';
import { TNodeContext } from '../components/apis/types/node';
import { STORY_VIEW_ID } from './story-demiurge-space';
import { WhiteboardMode } from '../components/demiurge-space';
import { TSpaceEvent } from '../space-events';
import { SpaceState } from '../components/apis/spaceState';
import { defaultGraphView } from '../space-types';

//

export const storyDefineOneNode = (
  sharedData: TCoreSharedData,
  dispatcher: FrontendDispatcher<TSpaceEvent>,
  sharedTypes: SharedTypes,
  inputs: number,
  outputs: number,
  nodeId: string
) => {
  sharedTypes.transaction(async () => {
    const connectors = [];

    if (inputs !== undefined) {
      connectors.push({
        connectorName: 'inputs',
        pins: Array.from({ length: inputs }, (_, i) => ({
          id: `input-${i + 1}`,
          pinName: `input-${i + 1}`,
        })),
      });
    }

    if (outputs !== undefined) {
      connectors.push({
        connectorName: 'outputs',
        pins: Array.from({ length: outputs }, (_, i) => ({
          id: `output-${i + 1}`,
          pinName: `output-${i + 1}`,
        })),
      });
    }

    (sharedData as TCoreSharedData)['core-graph:nodes'].set(nodeId, {
      root: true,
      id: nodeId,
      name: nodeId,
      type: 'whatever',
      connectors,
    });
  });

  dispatcher.dispatch({
    type: 'space:new-view',
    viewId: STORY_VIEW_ID,
  });
};

//

export const StoryMockSpaceContextReactflowBgAndCss = ({
  children,
  selected,
  isOpened = true,
  nodeId,
  inputs,
  outputs,
}: {
  children: ReactNode;
  selected?: boolean;
  isOpened?: boolean;
  nodeId?: string;
  inputs?: number;
  outputs?: number;
}) => {
  //

  const spaceState = useMemo(() => {
    const ss = new SpaceState();

    const node: TGraphNode = {
      id: nodeId || '',
      name: nodeId || '',
      root: true,
      type: 'whatever',
      connectors: [
        {
          connectorName: 'inputs',
          pins: Array.from({ length: inputs || 0 }, (_, i) => ({
            id: `input-${i + 1}`,
            pinName: `input-${i + 1}`,
          })),
        },
        {
          connectorName: 'outputs',
          pins: Array.from({ length: outputs || 0 }, (_, i) => ({
            id: `output-${i + 1}`,
            pinName: `output-${i + 1}`,
          })),
        },
      ],
    };

    ss.setState(defaultGraphView(), new Map([[nodeId || '', node]]));
    return ss;
  }, [nodeId, inputs, outputs]);

  return (
    <StoryMockSpaceContext spaceState={spaceState}>
      <MockSpaceBackground />
      <MockReactFlowNodeCSS selected={selected || false} isOpened={isOpened}>
        {children}
      </MockReactFlowNodeCSS>
    </StoryMockSpaceContext>
  );
};

//

export const StoryMockSpaceContext = ({
  children,
  spaceState,
}: {
  children: ReactNode;
  spaceState?: SpaceState;
}) => {
  //const sdm = useLocalSharedDataManager<TSpaceSharedData & TCoreSharedData>();

  const context: TSpaceContext = useMemo(() => {
    return {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      spaceState: spaceState || ({} as any), // new CollabSpaceState(STORY_VIEW_ID, sdm),
      currentUser: { username: 'toto', color: '#ffa500' },
      mode: 'default' as WhiteboardMode,
      viewId: STORY_VIEW_ID,
      edgeMenu: null,
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      setEdgeMenu: () => {},
      // eslint-disable-next-line @typescript-eslint/no-empty-function
      resetEdgeMenu: () => {},
    };
  }, [spaceState]);

  return (
    <ReactflowLayerContext value={{ ...context }}>
      {children}
    </ReactflowLayerContext>
  );
};

//

const MockSpaceBackground = () => (
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

const MockReactFlowNodeCSS = ({
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
