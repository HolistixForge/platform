import { icons } from '@monorepo/ui-base';
import {
  Inputs,
  Outputs,
  TNodeContext,
  useConnector,
  NodeToolbar,
  useMakeButton,
} from '@monorepo/space';

import { MenuExpanded } from '../menuExpanded/menuExpanded';

import './node-vault.scss';

//

export type NodeVaultProps = {
  color: string;
  inputs: number;
  outputs: number;
} & Pick<
  TNodeContext,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

export const NodeVault = ({
  isOpened,
  open,
  close,
  color,
  inputs,
  outputs,
  id: nodeId,
  reduce,
  expand,
  viewStatus,
}: NodeVaultProps) => {
  //

  const isExpanded = viewStatus?.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded: isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const { isOpened: inConOpened = false } =
    useConnector(nodeId, 'inputs') || {};

  return (
    <div className="node-wrapper">
      {!isExpanded && (
        <div
          className={`node-menu node-hover-visible ${
            inConOpened ? 'input-open-left' : ''
          }`}
        >
          <NodeToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Output bottom */}
      <Outputs nodeId={nodeId} />

      <Inputs nodeId={nodeId} />

      {/* Input top-right */}
      {!isExpanded && <NodeInputsOutputsGrid type="input" count={inputs} />}

      {/* Output bottom-right */}
      {!isExpanded && <NodeInputsOutputsGrid type="output" count={outputs} />}

      {/* Middle node */}
      {!isExpanded && (
        <div className={`node-octogone vault`}>
          <div className="content">
            <icons.Vault
              style={{
                width: '32px',
                height: '60px',
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

      {isExpanded && (
        <MenuExpanded
          nodeType="vault"
          nodeName="Vault #1"
          nodeInfos={['( 2 000 150 , 45 )', '( 2 000 150 , 45 )']}
          toolbarButtons={buttons}
        />
      )}

      {/* Main infos right */}
      {!isExpanded && (
        <div className="node-right-infos main-infos">
          <p>Vault #1</p>
          <ul>
            <li>parquet</li>
            <li>( 2 000 150 , 45)</li>
          </ul>
        </div>
      )}
    </div>
  );
};

//
//

export const NodeInputsOutputsGrid = ({
  count,
  type,
}: {
  count: number;
  type: 'input' | 'output';
}) => {
  return (
    <div
      className={`node-io-grid-${type} ${
        count > 9 ? `number-field-${type}` : ''
      }`}
    >
      {count < 10 ? (
        <div className={`${type}-grid`}>
          {Array(count)
            .fill(1)
            .map((_, i) => (
              <span key={i} />
            ))}
        </div>
      ) : (
        <div className="number">
          <p>{count}</p>
        </div>
      )}
    </div>
  );
};
