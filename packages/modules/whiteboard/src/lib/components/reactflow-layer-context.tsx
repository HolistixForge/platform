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

export const useSpaceContext = () => useContext(spaceContext) as TWhiteboardContext;
