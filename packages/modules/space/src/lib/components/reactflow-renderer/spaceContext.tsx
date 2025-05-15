import { createContext, useContext, ReactNode } from 'react';
import { ReactFlowProvider } from '@xyflow/react';
import { SpaceState } from '../apis/spaceState';
import { SpaceAwareness } from '../apis/spaceAwareness';
import { WhiteboardMode } from './demiurge-space';

//

export type TSpaceContext = {
  spaceAwareness: SpaceAwareness;
  spaceState: SpaceState;
  currentUser?: { username: string; color: string };
  mode: WhiteboardMode;
  viewId: string;
};

//

const spaceContext = createContext<TSpaceContext | null>(null);

//

export const SpaceContext = ({
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
