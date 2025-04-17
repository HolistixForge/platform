import {
  createContext,
  FC,
  useContext,
  MouseEvent,
  useRef,
  useState,
} from 'react';
import {
  ReactFlowState,
  useStore,
  useConnection,
  Handle,
  Position,
} from '@xyflow/react';
import { useHotkeys } from 'react-hotkeys-hook';

import { useDebugComponent } from '@monorepo/log';
import { useRegisterListener } from '@monorepo/simple-types';

import { TNodeContext } from '../../apis/types/node';
import { SelectionsAwareness } from './selection-awareness';
import { useSpaceContext } from '../spaceContext';
import { isNodeOpened, TNodeViewStatus } from '../../../space-types';
import { SpaceNode } from '../to-rf-nodes';
import { DisableZoomDragPan } from './disable-zoom-drag-pan';

import './node-wrapper.scss';

//
//
//

const zoomSelector = (s: ReactFlowState) => {
  // console.log(s);
  return s.transform[2];
};

//
//

const nodeContext = createContext<TNodeContext | null>(null);

//
//

const EasyConnect: FC<{ id: string }> = ({ id }) => {
  const [isCtrlPressed, setIsCtrlPressed] = useState(false);
  const connection = useConnection();

  useHotkeys(['ctrl', 'meta'], () => setIsCtrlPressed(true), { keydown: true });
  useHotkeys(['ctrl', 'meta'], () => setIsCtrlPressed(false), { keyup: true });

  const isTarget = connection.inProgress && connection.fromNode.id !== id;
  const label = isTarget ? 'Drop here' : 'Drag to connect';

  return (
    <div
      className={`easy-connect-handle-box ${
        isCtrlPressed ? 'easy-connect-active' : ''
      }`}
    >
      {!connection.inProgress && (
        <Handle
          className="easy-connect-handle"
          position={Position.Right}
          type="source"
          id="easy-connect-source"
          isConnectable={isCtrlPressed}
        />
      )}
      {(!connection.inProgress || isTarget) && (
        <Handle
          className="easy-connect-handle"
          position={Position.Left}
          type="target"
          isConnectableStart={false}
          id="easy-connect-target"
          isConnectable={isCtrlPressed}
        />
      )}
      {label}
    </div>
  );
};

//
//

const MoveNodeMode = ({ moveNodeMode }: { moveNodeMode: boolean }) => {
  return (
    moveNodeMode && (
      <div className="move-node-mode">
        <div style={{ width: '100%', height: '100%' }}>Move node mode</div>
      </div>
    )
  );
};

//
//

export const NodeWrapper =
  (NodeComponent: FC) =>
  ({ id, data }: SpaceNode) => {
    //
    const zoom = useStore(zoomSelector);
    const nodeRef = useRef<HTMLDivElement>(null);

    const {
      spaceActionsDispatcher: sad,
      spaceAwareness,
      currentUser,
      moveNodeMode,
    } = useSpaceContext();

    useRegisterListener(spaceAwareness);

    //

    const { nv, viewId } = data;

    const close = () => sad.dispatch({ type: 'close-node', nid: id });

    const open = () => sad.dispatch({ type: 'open-node', nid: id });

    const reduce = () => sad.dispatch({ type: 'reduce-node', nid: id });

    const expand = () => sad.dispatch({ type: 'expand-node', nid: id });

    const filterOut = () => sad.dispatch({ type: 'filter-out-node', nid: id });

    const opened = isNodeOpened(nv.status);

    const selectingUsers = spaceAwareness.getSelectedNodes()[id] || [];

    // is this object selected on this view by current user ?
    const selected =
      currentUser &&
      selectingUsers.find(
        (u) => u.user.username === currentUser.username && u.viewId === viewId
      )
        ? true
        : false;

    const contextValue: TNodeContext = {
      id,
      zoom,
      isOpened: opened,
      viewId,
      viewStatus: nv.status,
      open,
      close,
      reduce,
      expand,
      selectingUsers,
      selected,
      filterOut,
    };

    const handleResizeStart = (e: MouseEvent) => {
      e.stopPropagation();

      const startPos = { x: e.clientX, y: e.clientY };

      const startSize = nodeRef.current
        ? nodeRef.current.getBoundingClientRect()
        : { width: 0, height: 0 };
      startSize.width = startSize.width / zoom;
      startSize.height = startSize.height / zoom;

      let newSize = { width: startSize.width, height: startSize.height };

      nodeRef.current && (nodeRef.current.style.border = `dashed 1px #fff`);

      const handleResizeMove = (e: globalThis.MouseEvent) => {
        const dx = (e.clientX - startPos.x) / zoom;
        const dy = (e.clientY - startPos.y) / zoom;

        newSize = {
          width: Math.floor(startSize.width + dx),
          height: Math.floor(startSize.height + dy),
        };

        nodeRef.current && (nodeRef.current.style.width = `${newSize.width}px`);
        nodeRef.current &&
          (nodeRef.current.style.height = `${newSize.height}px`);
      };

      const handleResizeEnd = () => {
        nodeRef.current && (nodeRef.current.style.border = `none`);

        sad.dispatch({
          type: 'resize-node',
          nid: id,
          size: newSize,
        });

        document.removeEventListener('mousemove', handleResizeMove);
        document.removeEventListener('mouseup', handleResizeEnd);
      };

      document.addEventListener('mousemove', handleResizeMove);
      document.addEventListener('mouseup', handleResizeEnd);
    };

    const size = nv.size
      ? {
          width: nv.size.width ? `${Math.floor(nv.size.width)}px` : undefined,
          height: nv.size.height
            ? `${Math.floor(nv.size.height)}px`
            : undefined,
        }
      : undefined;

    //

    return (
      <nodeContext.Provider value={contextValue}>
        <div
          ref={nodeRef}
          className={`node-wrapper ${opened ? 'node-opened' : 'node-closed'}`}
          style={{
            ...size,
            position: 'relative',
          }}
        >
          <SelectionsAwareness selectingUsers={selectingUsers}>
            <div
              style={{ position: 'relative', height: '100%' }}
              onClick={() => spaceAwareness.selectNode(id, true)}
            >
              <NodeComponent />
              <EasyConnect id={id} />
              <MoveNodeMode moveNodeMode={moveNodeMode} />
            </div>
          </SelectionsAwareness>

          <div className="resize-handle-container">
            <DisableZoomDragPan noDrag>
              <div
                className="resize-handle"
                style={{
                  position: 'absolute',
                  bottom: 0,
                  right: 0,
                  width: '10px',
                  height: '10px',
                  cursor: 'se-resize',
                  borderBottom: '2px solid #fff',
                  borderRight: '2px solid #fff',
                  borderRadius: '0 0 2px 0',
                }}
                onMouseDown={handleResizeStart}
              />
            </DisableZoomDragPan>
          </div>
        </div>
        <NodeStatusDebugOverlay {...nv.status} zoom={zoom} />
      </nodeContext.Provider>
    );
  };

//
//

export const useNodeContext = () => {
  const v = useContext(nodeContext) as TNodeContext;
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
