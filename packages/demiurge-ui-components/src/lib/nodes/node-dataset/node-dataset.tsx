import { icons } from '../../assets/icons';
import { MenuExpanded } from '../../menuExpanded/menuExpanded';
import { Outputs } from '../../demiurge-space-2';
import { NodeToolbar, useMakeButton } from '../node-common/node-toolbar';
import { TUseNodeValue } from '@monorepo/demiurge-types';
import { useConnector } from '../../demiurge-space-2/reactflow-renderer/assets/inputsOutputs/inputsOutputs';

import './node-dataset.scss';

//
//
//

export type NodeDatasetProps = {
  color: string;
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'reduce' | 'expand' | 'viewStatus'
>;

export const NodeDataset = ({
  color,
  id: nodeId,
  isOpened,
  open,
  close,
  reduce,
  expand,
  viewStatus,
}: NodeDatasetProps) => {
  const outCon = useConnector(nodeId, 'outputs');

  const isExpanded = viewStatus?.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  return (
    <div className="node-wrapper">
      {!isExpanded && (
        <div className={`node-menu node-hover-visible menu-dataset`}>
          <NodeToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Output bottom */}
      <Outputs nodeId={nodeId} slots={outCon.slots} />

      {/* Main infos top */}
      {!isExpanded && (
        <div className="node-infos-top main-infos">
          <p>Capture Dataset #1</p>
          <ul>
            <li>parquet</li>
            <li>( 2 000 150 , 45 ) </li>
          </ul>
        </div>
      )}

      {isExpanded && (
        <MenuExpanded
          toolbarButtons={buttons}
          nodeType="dataset"
          nodeName="Capture Dataset #1"
          nodeInfos={['parquet', '( 2 000 150 , 45 )']}
        />
      )}

      {/* Middle node */}
      {!isExpanded && (
        <div className={`node-octogone dataset`}>
          <div className="content">
            <icons.Ticket
              style={{
                width: '80px',
                height: '80px',
              }}
            />
          </div>
          {/* Particles */}
          <ul>
            <li
              className="animate-floating"
              style={{
                backgroundColor: color,
              }}
            />
            <li
              className="animate-floating"
              style={{
                backgroundColor: color,
              }}
            />
            <li
              className="animate-floating"
              style={{
                backgroundColor: color,
              }}
            />
          </ul>
        </div>
      )}
    </div>
  );
};
