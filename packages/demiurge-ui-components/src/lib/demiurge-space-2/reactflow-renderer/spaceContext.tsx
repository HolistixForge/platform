import { createContext, useContext, ReactNode } from 'react';
import { ReactFlowProvider } from 'reactflow';
import { SpaceActionsDispatcher } from './spaceActionsDispatcher';
import { SpaceAwareness } from './spaceAwareness';
import { SpaceState } from './spaceState';

//

export type TSpaceContext = {
  spaceActionsDispatcher: SpaceActionsDispatcher;
  spaceAwareness: SpaceAwareness;
  spaceState: SpaceState;
  currentUser?: { username: string; color: string };
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
