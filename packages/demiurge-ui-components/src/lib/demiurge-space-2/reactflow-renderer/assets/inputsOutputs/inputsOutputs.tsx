import { useState, useCallback } from 'react';
import { icons } from '../../../../assets/icons';
import { Slot } from '../slot/Slot';
import { Handle, Position, useUpdateNodeInternals } from 'reactflow';
import { useSpaceContext } from '../../spaceContext';

import './inputsOutputs.css';

/*
 *
 */

type InputsProps = {
  nodeId: string;
  forceOpened?: boolean;
  disabled?: boolean;
};

/** one connector */
export type InputsOutputsProps = InputsProps & {
  connectorName: string;
};

/**
 *
 *
 */

const getHandleFromEvent = (event: React.MouseEvent) => {
  const target = event.target as HTMLElement;
  const handleId = target.getAttribute('data-handleid') as string;
  const nodeId = target.getAttribute('data-nodeid') as string;
  return { handleId, nodeId };
};

/**
 *
 */

export const useConnector = (nodeId: string, connectorName: string) => {
  const { spaceActionsDispatcher, spaceState } = useSpaceContext();

  const [forceHighlight, setForceHighlight] = useState(false);

  const updateNodeInternals = useUpdateNodeInternals();

  const c = spaceState.getConnector(nodeId, connectorName);

  if (!c) throw new Error('oops');

  const { isOpened, groupedEdgesCount, slots, type } = c;

  const openClose: () => void = useCallback(() => {
    /* the open close action display and hide the handles
     * so updateNodeInternals() is called to force reactFlow to update
     * internal state of handlers position   */
    spaceActionsDispatcher.dispatch({
      type: isOpened ? 'close-connector' : 'open-connector',
      nid: nodeId,
      connectorName,
    });
    setTimeout(() => {
      // TODO_: edges readraw is delayed and it's ugly
      updateNodeInternals(nodeId);
    }, 500);
  }, [nodeId, connectorName, isOpened, updateNodeInternals]);

  //

  const handleMouseOver = useCallback((event: React.MouseEvent) => {
    const h = getHandleFromEvent(event);
    spaceActionsDispatcher.dispatch({
      type: 'highlight',
      nid: nodeId,
      connectorName,
    });
  }, []);

  //

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent) => {
      // if handle not been clicked, remove highlight by passing a non
      // existing {nodeId, handleId} so no edges will match
      !forceHighlight &&
        spaceActionsDispatcher.dispatch({
          type: 'unhighlight',
          nid: nodeId,
          connectorName,
        });
    },
    [forceHighlight]
  );

  //

  const handleLockHighlight = useCallback((event: React.MouseEvent) => {
    setForceHighlight(true);
  }, []);

  return {
    openClose,
    handleMouseOver,
    handleMouseLeave,
    handleLockHighlight,
    groupedEdgesCount,
    type,
    isOpened,
    slots,
  };
};

/**
 *
 *
 */

const GroupHandle = ({
  connectorName,
  count,
  isConnectable = false,
  type,
}: {
  connectorName: string;
  count: number;
  isConnectable?: boolean;
  type: 'source' | 'target';
}) => {
  return (
    <div className="edges-count">
      <span>{count}</span>
      <Handle
        type={type}
        position={connectorName === 'inputs' ? Position.Top : Position.Bottom}
        isConnectable={isConnectable}
        id=""
      />
    </div>
  );
};

/**
 *
 *
 */

export const InputsOutputs = ({
  connectorName,
  nodeId,
  forceOpened = false,
  disabled = false,
}: InputsOutputsProps) => {
  //

  const {
    openClose,
    handleMouseOver,
    handleMouseLeave,
    handleLockHighlight,
    groupedEdgesCount,
    type,
    isOpened,
    slots,
  } = useConnector(nodeId, connectorName);

  /**
   * if it is a simple input
   */

  if (slots === undefined) {
    return (
      <div
        className={
          connectorName === 'inputs'
            ? 'node-inputs-closed'
            : 'node-outputs-closed'
        }
      >
        <GroupHandle
          connectorName={connectorName}
          type={type}
          isConnectable={!disabled}
          count={groupedEdgesCount}
        />
        <div className="handles-bar">
          {type === 'target' ? (
            <icons.Input className="icon-closed" />
          ) : (
            <icons.Output className="icon-closed" />
          )}
        </div>
      </div>
    );
  }

  /**
   * else it is a piano inputs or outputs
   */

  const renderOpened = isOpened || forceOpened;

  /** wether the handles bar must be displayed or just the grouped edges handle */
  const groupsHandleVisible = groupedEdgesCount > 0 || !renderOpened;

  if (!renderOpened)
    return (
      <div
        className={
          type === 'target' ? 'node-inputs-closed' : 'node-outputs-closed'
        }
      >
        {groupsHandleVisible && (
          <GroupHandle
            type={type}
            connectorName={connectorName}
            isConnectable={!disabled}
            count={groupedEdgesCount}
          />
        )}
        <div className="handles-bar">
          {type === 'target' ? (
            <icons.Input className="icon-closed" onClick={openClose} />
          ) : (
            <icons.Output className="icon-closed" onClick={openClose} />
          )}

          <icons.Eye
            onClick={openClose}
            className="icon-eye"
            style={{
              position: 'absolute',
              right: '-30px',
            }}
          />
        </div>
      </div>
    );
  else
    return (
      <div
        className={
          type === 'target' ? 'node-inputs-opened' : 'node-outputs-opened'
        }
      >
        {groupsHandleVisible && (
          <GroupHandle
            connectorName={connectorName}
            type={type}
            isConnectable={!disabled}
            count={groupedEdgesCount}
          />
        )}
        <div className="handles-bar">
          {type === 'target' ? (
            <icons.InputLeft onClick={openClose} />
          ) : (
            <icons.OutputLeft onClick={openClose} />
          )}
          <icons.EyeSlash
            className="icon-eye"
            onClick={openClose}
            style={{
              position: 'absolute',
              right: '-30px',
            }}
          />
          <ul>
            {slots &&
              slots.map((s) => (
                <Slot
                  key={s.id}
                  name={s.name}
                  type={type}
                  position={type === 'target' ? Position.Top : Position.Bottom}
                  id={s.id}
                  isConnectable={
                    s.isConnectable !== undefined ? s.isConnectable : true
                  }
                  onMouseOver={handleMouseOver}
                  onMouseLeave={handleMouseLeave}
                  onClick={handleLockHighlight}
                />
              ))}
          </ul>
          {type === 'target' ? (
            <icons.InputRight onClick={openClose} />
          ) : (
            <icons.OutputRight onClick={openClose} />
          )}
        </div>
      </div>
    );
};

/**
 *
 */

export const Inputs = (props: InputsProps) => (
  <InputsOutputs connectorName="inputs" {...props} />
);

export const Outputs = (props: InputsProps) => (
  <InputsOutputs connectorName="outputs" {...props} />
);

//

export const InputsAndOutputs = ({
  id,
  top = true,
  bottom = true,
  topDisabled = false,
  bottomDisabled = false,
}: {
  id: string;
  top?: boolean;
  bottom?: boolean;
  topDisabled?: boolean;
  bottomDisabled?: boolean;
}) => {
  return (
    <>
      {top && <Inputs nodeId={id} disabled={topDisabled} />}
      {bottom && <Outputs nodeId={id} disabled={bottomDisabled} />}
    </>
  );
};
