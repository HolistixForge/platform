import { createContext, useContext, ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { WhiteboardState } from './apis/whiteboardState';
import { WhiteboardMode } from './whiteboard';

//

export type TWhiteboardContext = {
  spaceState: WhiteboardState;
  mode: WhiteboardMode;
  viewId: string;
  edgeMenu: {
    edgeId: string;
    x: number;
    y: number;
  } | null;
  setEdgeMenu: (edgeMenu: { edgeId: string; x: number; y: number }) => void;
  resetEdgeMenu: () => void;
};

//

const spaceContext = createContext<TWhiteboardContext | null>(null);

//

export const ReactflowLayerContext = ({
  value,
  children,
}: { value: TWhiteboardContext } & { children: ReactNode }) => {
  return (
    <spaceContext.Provider value={value}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </spaceContext.Provider>
  );
};

//

export const useSpaceContext = () =>
  useContext(spaceContext) as TWhiteboardContext;

//

/**
 * The board's interaction mode, on its own.
 *
 * Narrower than `useSpaceContext` on purpose: a node drawn inside the
 * Excalidraw scene needs to know whether the board is in move mode, and
 * nothing else from the context. Reaching for the whole thing would make it
 * re-render on every edge-menu open.
 *
 * Falls back to `default` outside a provider — a node rendered in a story or
 * a test is not in move mode, and throwing there would say nothing useful.
 */
export const useWhiteboardMode = (): WhiteboardMode =>
  useContext(spaceContext)?.mode ?? 'default';
