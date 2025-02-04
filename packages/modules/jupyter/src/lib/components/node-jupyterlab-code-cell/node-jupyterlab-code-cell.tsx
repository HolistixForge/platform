import { ReactNode } from 'react';

import {
  InputsAndOutputs,
  DisablePanSelect,
  TUseNodeValue,
  NodeHeader,
  useMakeButton,
} from '@monorepo/space';

import {
  CodeEditorMonaco,
  CodeEditorMonacoProps,
} from '../code-editor-monaco/code-editor-monaco-lazy';

import './node-jupyterlab-code-cell.scss';

//
//
//

export type NodeJupyterlabCodeCellProps = {
  code: string;
  busy?: boolean;
  onExecute: () => void;
  children: ReactNode;
  onClearOutput: () => void;
  onDelete: () => Promise<void>;
  onEditorMount: CodeEditorMonacoProps['onMount'];
} & Pick<
  TUseNodeValue,
  'id' | 'isOpened' | 'open' | 'close' | 'viewStatus' | 'expand' | 'reduce'
>;

export const NodeJupyterlabCodeCell = ({
  id,
  isOpened,
  open,
  close,
  code,
  busy,
  children,
  onExecute,
  onClearOutput,
  onDelete,
  onEditorMount,
  viewStatus,
  expand,
  reduce,
}: NodeJupyterlabCodeCellProps) => {
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
    onClear: onClearOutput,
    onPlay: onExecute,
  });

  return (
    <div className={`common-node node-jupyterlab-code-cell ${busy && 'busy'}`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="python"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
          <div className="node-wrapper-body jupyterlab-code-cell">
            <CodeEditorMonaco id={id} code={code} onMount={onEditorMount} />
            {children}
          </div>
        </DisablePanSelect>
      )}
    </div>
  );
};
