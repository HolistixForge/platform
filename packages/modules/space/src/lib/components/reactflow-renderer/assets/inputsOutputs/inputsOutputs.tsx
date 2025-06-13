import { useCallback, useState } from 'react';
import { Handle, Position, useUpdateNodeInternals } from '@xyflow/react';

import { useDispatcher } from '@monorepo/collab-engine';

import { icons } from './icons';
import { Slot } from '../slot/Slot';
import { useSpaceContext } from '../../spaceContext';
import { fromPinId } from '../../../apis/types/edge';
import { TSpaceEvent } from '../../../../space-events';

import './inputsOutputs.css';

/*
 *
 */

type InputsProps = {
  nodeId: string;
  forceOpened?: boolean;
  disabled?: boolean;
  invisible?: boolean;
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
  const { spaceState, viewId } = useSpaceContext();
  const dispatcher = useDispatcher<TSpaceEvent>();

  const updateNodeInternals = useUpdateNodeInternals();

  const c = spaceState.getConnector(nodeId, connectorName);

  const [isHovered, setIsHovered] = useState(false);

  // if (!c) throw new Error('oops');

  const {
    isOpened = false,
    groupedEdgesCount = 0,
    noPinEdges = [],
    pins = [],
    type = 'source',
  } = c || {};

  const openClose: () => void = useCallback(() => {
    /* the open close action display and hide the handles
     * so updateNodeInternals() is called to force reactFlow to update
     * internal state of handlers position   */
    dispatcher.dispatch({
      type: isOpened ? 'space:close-connector' : 'space:open-connector',
      nid: nodeId,
      connectorName,
      viewId,
    });
    setTimeout(() => {
      // TODO_: edges readraw is delayed and it's ugly
      updateNodeInternals(nodeId);
    }, 500);
  }, [nodeId, connectorName, isOpened, updateNodeInternals]);

  //

  const handleMouseOver = useCallback(
    (event: React.MouseEvent) => {
      if (isHovered) return;
      setIsHovered(true);
      const h = getHandleFromEvent(event);
      const { connectorName, pinName } = fromPinId(h.handleId);
      dispatcher.dispatch({
        type: 'space:highlight',
        nid: nodeId,
        connectorName,
        pinName,
        viewId,
      });
    },
    [isHovered]
  );

  //

  const handleMouseLeave = useCallback(
    (event: React.MouseEvent) => {
      if (!isHovered) return;
      setIsHovered(false);
      // if handle not been clicked, remove highlight by passing a non
      // existing {nodeId, handleId} so no edges will match

      const h = getHandleFromEvent(event);
      const { connectorName, pinName } = fromPinId(h.handleId);
      dispatcher.dispatch({
        type: 'space:unhighlight',
        nid: nodeId,
        connectorName,
        pinName,
        viewId,
      });
    },
    [isHovered]
  );

  //
  if (!c) return false;

  return {
    openClose,
    handleMouseOver,
    handleMouseLeave,
    groupedEdgesCount,
    noPinEdges,
    type,
    isOpened,
    pins,
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
  onMouseOver,
  onMouseLeave,
}: {
  connectorName: string;
  count: number;
  isConnectable?: boolean;
  type: 'source' | 'target';
  onMouseOver?: (event: React.MouseEvent) => void;
  onMouseLeave?: (event: React.MouseEvent) => void;
}) => {
  return (
    <div className="edges-count">
      <span style={{ pointerEvents: 'none' }}>{count}</span>
      <Handle
        type={type}
        position={connectorName === 'inputs' ? Position.Top : Position.Bottom}
        isConnectable={isConnectable}
        id={connectorName}
        onMouseOver={onMouseOver}
        onMouseLeave={onMouseLeave}
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

  const uc = useConnector(nodeId, connectorName);

  if (!uc) return null;

  const {
    openClose,
    handleMouseOver,
    handleMouseLeave,
    groupedEdgesCount,
    noPinEdges,
    type,
    isOpened,
    pins,
  } = uc;

  /**
   * if it is a simple input
   */

  if (pins === undefined || pins.length === 0) {
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
          onMouseOver={handleMouseOver}
          onMouseLeave={handleMouseLeave}
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
  const groupsHandleVisible =
    groupedEdgesCount > 0 || noPinEdges.length > 0 || !renderOpened;

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
            onMouseOver={handleMouseOver}
            onMouseLeave={handleMouseLeave}
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
            onMouseOver={handleMouseOver}
            onMouseLeave={handleMouseLeave}
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
            {pins &&
              pins.map((p) => (
                <Slot
                  key={p.pinName}
                  name={p.pinName}
                  type={type}
                  position={type === 'target' ? Position.Top : Position.Bottom}
                  id={p.id}
                  isConnectable={!p.disabled}
                  onMouseOver={handleMouseOver}
                  onMouseLeave={handleMouseLeave}
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

export const Inputs = (props: InputsProps) => {
  if (props.invisible)
    return (
      <Handle
        type="target"
        position={Position.Top}
        id={'inputs'}
        className="invisible-handle"
        isConnectable={false}
      />
    );

  return <InputsOutputs connectorName="inputs" {...props} />;
};

export const Outputs = (props: InputsProps) => {
  if (props.invisible)
    return (
      <Handle
        type="source"
        position={Position.Bottom}
        id={'outputs'}
        className="invisible-handle"
        isConnectable={false}
      />
    );
  return <InputsOutputs connectorName="outputs" {...props} />;
};
//

export const InputsAndOutputs = ({
  id,
  top = true,
  bottom = true,
  topDisabled = false,
  bottomDisabled = false,
  invisible = false,
}: {
  id: string;
  top?: boolean;
  bottom?: boolean;
  topDisabled?: boolean;
  bottomDisabled?: boolean;
  invisible?: boolean;
}) => {
  return (
    <>
      {top && (
        <Inputs nodeId={id} disabled={topDisabled} invisible={invisible} />
      )}
      {bottom && (
        <Outputs nodeId={id} disabled={bottomDisabled} invisible={invisible} />
      )}
    </>
  );
};
