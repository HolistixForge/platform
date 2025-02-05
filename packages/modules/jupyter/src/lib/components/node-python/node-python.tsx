import { icons, SelectFieldset, SelectItem } from '@monorepo/ui-base';
import {
  Inputs,
  Outputs,
  TNodeContext,
  useConnector,
  NodeToolbar,
  useMakeButton,
} from '@monorepo/space';

import { MenuExpanded } from '../menuExpanded/menuExpanded';

//

export type NodePythonProps = {
  color: string;
  nodeInfos: boolean;
  status: 'success' | 'error' | 'loading';
} & Pick<
  TNodeContext,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

//

export const NodePython = ({
  isOpened,
  open,
  close,
  color,
  nodeInfos,
  status,
  id: nodeId,
  viewStatus,
  reduce,
  expand,
}: NodePythonProps) => {
  const isExpanded = viewStatus?.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
  });

  const inCon = useConnector(nodeId, 'inputs');
  const outCon = useConnector(nodeId, 'outputs');

  return (
    <div className="node-wrapper">
      {/* Menu top left */}
      {!isExpanded && (
        <div
          className={`node-menu node-hover-visible  ${
            inCon.isOpened ? 'input-open-left' : ''
          }`}
        >
          <NodeToolbar className="outside" buttons={buttons} />
        </div>
      )}

      {/* Main infos top-right */}
      {!isExpanded && (
        <div
          className={`node-infos main-infos node-hover-visible  ${
            inCon.isOpened ? 'input-open-right' : ''
          }`}
        >
          <div className="head">
            <p>Node #123456</p>
            <div
              style={{
                backgroundColor: color,
              }}
            />
          </div>
          <ul
            style={{
              display: nodeInfos ? 'block' : 'none',
            }}
          >
            <li>( 2 000 150 , 45 ) </li>
            <li>( 2 000 150 , 45 ) </li>
          </ul>
        </div>
      )}

      {/* Module right */}
      {!isExpanded && (
        <div className={`node-right node-hover-visible`}>
          <div
            className={`top ${status === 'loading' ? 'rotate-animation' : ''}`}
          >
            {
              // Status
              status === 'success' ? (
                <icons.Success />
              ) : status === 'error' ? (
                <icons.Error />
              ) : status === 'loading' ? (
                <icons.Loading />
              ) : (
                <icons.Loading />
              )
            }
          </div>
          <div className="bottom"></div>
          <div className="right"></div>
        </div>
      )}

      {/* Module left */}
      {!isExpanded && (
        <div className={`node-left node-hover-visible`}>
          <div className="top"></div>
          <div className="bottom"></div>
          <div className="left"></div>
        </div>
      )}

      {/* Output Bottom */}
      <Outputs nodeId={nodeId} />

      {/* Input top */}
      <Inputs nodeId={nodeId} />

      {/* Info bottom-right */}
      {!isExpanded && (
        <div
          className={`node-bottom-right node-hover-visible  ${
            outCon.isOpened ? 'output-open-right' : ''
          }`}
        >
          <SelectFieldset
            name={''}
            value={'python 3.10.12 modele'}
            onChange={function (v: string): void {}}
            placeholder={''}
            className="small"
            integrated
          >
            {[
              'python 3.10.11 modele',
              'python 3.10.12 modele',
              'python 3.10.13 modele',
              'python 3.10.14 modele',
            ].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>
      )}

      {/* Info bottom-left */}
      {!isExpanded && (
        <div
          className={`node-bottom-left node-hover-visible  ${
            outCon.isOpened ? 'output-open-left' : ''
          }`}
        >
          <icons.Branch />
          <SelectFieldset
            name={''}
            value={'master'}
            onChange={function (v: string): void {}}
            placeholder={''}
            className="small"
            integrated
          >
            {['dev', 'master', 'prod', 'intern'].map((v) => (
              <SelectItem value={v}>{v}</SelectItem>
            ))}
          </SelectFieldset>
        </div>
      )}

      {isExpanded && (
        <MenuExpanded
          variant="footer"
          nodeName="Node #123456"
          nodeInfos={['( 2 000 150 , 45 )', '( 2 000 150 , 45 )']}
          nodeType="scene"
          toolbarButtons={buttons}
        />
      )}

      {/* Node */}
      {!isExpanded && (
        <div className={`node-octogone python`}>
          <div className="content">
            <icons.Scene />
          </div>
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
