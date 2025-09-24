import { createContext, useContext, ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SpaceState } from './apis/spaceState';
import { WhiteboardMode } from './holistix-space';

//

export type TSpaceContext = {
  spaceState: SpaceState;
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

const spaceContext = createContext<TSpaceContext | null>(null);

//

export const ReactflowLayerContext = ({
  value,
  children,
}: { value: TSpaceContext } & { children: ReactNode }) => {
  return (
    <spaceContext.Provider value={value}>
      <ReactFlowProvider>{children}</ReactFlowProvider>
    </spaceContext.Provider>
  );
};

//

export const useSpaceContext = () => useContext(spaceContext) as TSpaceContext;
