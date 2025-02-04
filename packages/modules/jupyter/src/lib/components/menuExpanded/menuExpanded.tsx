import {
  icons,
  ButtonIconProps,
  SelectFieldset,
  SelectItem,
} from '@monorepo/demiurge-ui-components';
import { NodeToolbar } from '@monorepo/space';

import './menuExpanded.scss';

//

export type MenuExpandedProps = {
  nodeType: 'scene' | 'vault' | 'dataset' | 'screening';
  nodeName: string;
  nodeInfos: string[];
  variant?: 'default' | 'footer';
  toolbarButtons: ButtonIconProps[];
};

export const MenuExpanded = ({
  nodeType,
  nodeName,
  nodeInfos,
  variant,
  toolbarButtons,
}: MenuExpandedProps) => {
  return (
    <div className="menu-expanded">
      <div className="header">
        <NodeToolbar buttons={toolbarButtons} />

        <div className="wrapper-menu">
          <div className="node-info">
            <p>{nodeName}</p>
            <ul>
              {nodeInfos?.map((info, index) => (
                <li key={index}>{info}</li>
              ))}
            </ul>
          </div>
          <div className="node-type">
            {nodeType === 'scene' ? (
              <icons.SceneMenu />
            ) : nodeType === 'vault' ? (
              <icons.VaultMenu />
            ) : nodeType === 'dataset' ? (
              <icons.DatasetMenu />
            ) : (
              <icons.ProjectionMenu />
            )}
            <div
              className={`badge ${
                nodeType === 'scene'
                  ? 'orange'
                  : nodeType === 'vault'
                  ? 'red'
                  : nodeType === 'dataset' || nodeType === 'screening'
                  ? 'blue'
                  : ''
              }`}
            >
              <p>{nodeType}</p>
            </div>
          </div>
        </div>
      </div>
      <div className="content"></div>
      {variant === 'footer' && (
        <div className="footer">
          <div>
            <icons.Branch
              style={{
                fill: 'white',
                marginRight: '5px',
              }}
            />

            <SelectFieldset
              name={''}
              value={'master'}
              onChange={function (v: string): void {}}
              placeholder={''}
              className="small"
              integrated
            >
              {['dev', 'master', 'prod', 'intern'].map((v) => (
                <SelectItem key={v} value={v}>
                  {v}
                </SelectItem>
              ))}
            </SelectFieldset>
          </div>

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
              <SelectItem key={v} value={v}>
                {v}
              </SelectItem>
            ))}
          </SelectFieldset>
        </div>
      )}
    </div>
  );
};
