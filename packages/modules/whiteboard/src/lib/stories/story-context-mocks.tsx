import { ReactNode, useMemo } from 'react';

import { TCoreSharedData, TGraphNode } from '@holistix-forge/core-graph';
import { FrontendDispatcher } from '@holistix-forge/reducers/frontend';
import { SharedTypes } from '@holistix-forge/collab-engine';

import {
  ReactflowLayerContext,
  TWhiteboardContext,
} from '../components/reactflow-layer-context';
import { TNodeContext } from '../components/apis/types/node';
import { STORY_VIEW_ID } from './story-whiteboard';
import { WhiteboardMode } from '../components/whiteboard';
import { TWhiteboardEvent } from '../whiteboard-events';
import { WhiteboardState } from '../components/apis/whiteboardState';
import { defaultGraphView } from '../whiteboard-types';

//

export const storyDefineOneNode = (
  sharedData: TCoreSharedData,
  dispatcher: FrontendDispatcher<TWhiteboardEvent>,
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
    type: 'whiteboard:new-view',
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
    const ss = new WhiteboardState();

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
    <StoryMockWhiteboardContext spaceState={spaceState}>
      <MockWhiteboardBackground />
      <MockReactFlowNodeCSS selected={selected || false} isOpened={isOpened}>
        {children}
      </MockReactFlowNodeCSS>
    </StoryMockWhiteboardContext>
  );
};

//

export const StoryMockWhiteboardContext = ({
  children,
  spaceState,
}: {
  children: ReactNode;
  spaceState?: WhiteboardState;
}) => {
  //const sdm = useLocalSharedDataManager<TWhiteboardSharedData & TCoreSharedData>();

  const context: TWhiteboardContext = useMemo(() => {
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

const MockWhiteboardBackground = () => (
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
