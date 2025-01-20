import { InputsAndOutputs } from '../../demiurge-space-2';
import { NodeHeader } from '../node-common/node-header';
import { DisablePanSelect } from '../../demiurge-space-2';
import { FC } from 'react';
import { useMakeButton } from '../node-common/node-toolbar';
import { TUseNodeValue } from '@monorepo/demiurge-types';

export type NodeTerminalProps = {
  server_name: string;
  project_server_id: number;
  onDelete: () => Promise<void>;
  Terminal: FC<{ server_name: string; project_server_id: number }>;
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

//
//

export const NodeTerminal = ({
  id,
  isOpened,
  open,
  close,
  onDelete,
  server_name,
  project_server_id,
  Terminal,
  viewStatus,
  expand,
  reduce,
}: NodeTerminalProps) => {
  //

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete,
    isOpened,
    open,
    close,
  });

  return (
    <div className={`common-node terminal-node`}>
      <InputsAndOutputs id={id} bottom={false} />
      <NodeHeader
        nodeType="terminal"
        id={id}
        open={open}
        isOpened={false}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body terminal">
            <Terminal
              project_server_id={project_server_id}
              server_name={server_name}
            />
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};
