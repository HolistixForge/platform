import { icons } from '../../assets/icons';
import { MenuExpanded } from '../../menuExpanded/menuExpanded';
import { Inputs, TUseNodeValue, useConnector } from '../../demiurge-space-2';
import { NodeInputsOutputsGrid } from '../node-vault/node-vault';
import { NodeToolbar, useMakeButton } from '../node-common/node-toolbar';

import './node-screening.scss';

//

export type NodeScreeningProps = {
  color: string;
  inputs: number;
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

export const NodeScreening = ({
  isOpened,
  open,
  close,
  color,
  inputs,
  id: nodeId,
  reduce,
  expand,
  viewStatus,
}: NodeScreeningProps) => {
  const isExpanded = viewStatus?.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded: isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const inCon = useConnector(nodeId, 'inputs');

  return (
    <div className="node-wrapper">
      {!isExpanded && (
        <div
          className={`node-menu node-hover-visible ${
            inCon.isOpened ? 'input-open-left' : ''
          }`}
        >
          <NodeToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Input icon top */}
      <Inputs nodeId={nodeId} />

      {/* Input top-right */}
      {!isExpanded && <NodeInputsOutputsGrid type="input" count={inputs} />}

      {/* Main infos */}
      {!isExpanded && (
        <div className="node-infos-bottom main-infos">
          <p>Screening #1</p>
          <ul>
            <li>parquet</li>
            <li>( 2 000 150 , 45 ) </li>
          </ul>
        </div>
      )}

      {isExpanded && (
        <MenuExpanded
          toolbarButtons={buttons}
          nodeType="screening"
          nodeName="sSreening #1"
          nodeInfos={['parquet', '( 2 000 150 , 45 )']}
        />
      )}

      {/* Node middle */}
      {!isExpanded && (
        <div className={`node-octogone screening`}>
          <div className="content">
            <icons.Projection
              style={{
                width: '60px',
                height: '40px',
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
