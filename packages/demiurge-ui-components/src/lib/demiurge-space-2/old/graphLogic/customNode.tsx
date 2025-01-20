import { Handle, Position } from 'reactflow';
import {
  InputsOutputsProps,
  useConnector,
} from '../../reactflow-renderer/assets/inputsOutputs/inputsOutputs';

/**
 *
 */

export const CustomNode = ({ data }: { data: { id: string } }) => {
  const { id } = data;
  return (
    <div>
      <div className="custom-node">
        <span>{id}</span>
      </div>
      <HandlesBar connectorName="inputs" type="target" nodeId={id} />
      <HandlesBar connectorName="outputs" type="source" nodeId={id} />
    </div>
  );
};

/**
 *
 */

export const HandlesBar = ({ nodeId, connectorName }: InputsOutputsProps) => {
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

  /** wether the handles bar must be displayed or just the grouped edges handle */
  const groupsHandleVisible = groupedEdgesCount > 0 || !isOpened;

  /**
   *
   */

  return (
    <div className={`handles-${type}-box`}>
      {groupsHandleVisible && (
        <div className={`group-${type}-handle-box`}>
          <Handle
            type={type}
            position={type === 'target' ? Position.Top : Position.Bottom}
            isConnectable={false}
          />
          <span>({groupedEdgesCount})</span>
        </div>
      )}

      {
        <div>
          {isOpened &&
            slots.map((s) => (
              <Handle
                key={s.id}
                type={type}
                position={type === 'target' ? Position.Top : Position.Bottom}
                isConnectable={true}
                id={s.id}
                onMouseOver={handleMouseOver}
                onMouseLeave={handleMouseLeave}
                onClick={handleLockHighlight}
              />
            ))}
        </div>
      }
      <button className="button-eye" onClick={openClose}>
        Eye
      </button>
    </div>
  );
};
