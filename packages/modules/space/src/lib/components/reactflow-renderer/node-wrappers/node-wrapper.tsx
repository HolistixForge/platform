import { useDebugComponent } from '@monorepo/log';
import { createContext, FC, useContext } from 'react';
import { ReactFlowState, useStore } from 'reactflow';
import { TUseNodeValue } from '../../apis/types/node';
import { SelectionsAwareness } from './selection-awareness';
import { useSpaceContext } from '../spaceContext';
import { useRegisterListener } from '../avatarsRenderer';
import { isNodeOpened, TNodeViewStatus } from '../../../space-types';

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

    const {
      spaceActionsDispatcher: sad,
      spaceAwareness,
      currentUser,
    } = useSpaceContext();

    useRegisterListener(spaceAwareness);

    const { viewStatus, viewId } = data;

    const close = () => sad.dispatch({ type: 'close-node', nid: id });

    const open = () => sad.dispatch({ type: 'open-node', nid: id });

    const reduce = () => sad.dispatch({ type: 'reduce-node', nid: id });

    const expand = () => sad.dispatch({ type: 'expand-node', nid: id });

    const opened = isNodeOpened(viewStatus);

    const selectingUsers = spaceAwareness.getSelectedNodes()[id] || [];
    console.log({ selectingUsers });

    // is this object selected on this view by current user ?
    const selected =
      currentUser &&
      selectingUsers.find(
        (u) => u.user.username === currentUser.username && u.viewId === viewId
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
        <SelectionsAwareness selectingUsers={selectingUsers}>
          <NodeComponent />
        </SelectionsAwareness>
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
