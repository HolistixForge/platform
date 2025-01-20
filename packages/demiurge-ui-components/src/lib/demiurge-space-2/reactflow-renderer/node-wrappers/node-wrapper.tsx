import { useDebugComponent } from '@monorepo/log';
import { createContext, FC, useContext } from 'react';
import { ReactFlowState, useStore } from 'reactflow';
import {
  isNodeOpened,
  TNodeViewStatus,
  TUseNodeValue,
} from '@monorepo/demiurge-types';
import { SelectionsAwareness } from './selection-awareness';
import { useSpaceContext } from '../spaceContext';

//
//
//

type NodeWrapperProps = {
  id: string;
  data: any;
};

//

const zoomSelector = (s: ReactFlowState) => {
  // console.log(s);
  return s.transform[2];
};

//
//

const nodeContext = createContext<TUseNodeValue | null>(null);

//
//

export const NodeWrapper =
  (NodeComponent: FC) =>
  ({ id, data }: NodeWrapperProps) => {
    //
    const zoom = useStore(zoomSelector);

    const { spaceActionsDispatcher: graphActionsDispatcher, spaceAwareness: graphAwareness, currentUser } =
      useSpaceContext();

    const { viewStatus, viewId } = data;

    const close = () =>
      graphActionsDispatcher.dispatch({ type: 'close-node', nid: id, viewId });

    const open = () =>
      graphActionsDispatcher.dispatch({ type: 'open-node', nid: id, viewId });

    const reduce = () =>
      graphActionsDispatcher.dispatch({ type: 'reduce-node', nid: id, viewId });

    const expand = () =>
      graphActionsDispatcher.dispatch({ type: 'expand-node', nid: id, viewId });

    const opened = isNodeOpened(viewStatus);

    const selectingUsers = graphAwareness.getSelectedNodes()[id] || [];

    // is this object selected on this view by current user ?
    const selected =
      currentUser &&
      selectingUsers.find(
        (u) => u.user.username === currentUser.username && u.viewId === viewId,
      )
        ? true
        : false;

    const contextValue: TUseNodeValue = {
      id,
      zoom,
      isOpened: opened,
      viewId,
      viewStatus: viewStatus,
      open,
      close,
      reduce,
      expand,
      selectingUsers,
      selected,
    };

    return (
      <nodeContext.Provider value={contextValue}>
        <NodeComponent />
        <SelectionsAwareness selectingUsers={selectingUsers} />
        <NodeStatusDebugOverlay {...viewStatus} zoom={zoom} />
      </nodeContext.Provider>
    );
  };

//
//

export const useNodeContext = () => {
  const v = useContext(nodeContext) as TUseNodeValue;
  return v;
};

//
//

const NodeStatusDebugOverlay = (s: TNodeViewStatus & { zoom: number }) => {
  const debug = useDebugComponent();
  if (debug)
    return (
      <div className="node-status-debug">
        {Object.entries(s).map(([k, v]) => (
          <p key={k}>
            {k}: {v.toString ? v.toString() : v}
          </p>
        ))}
      </div>
    );
  else return null;
};
