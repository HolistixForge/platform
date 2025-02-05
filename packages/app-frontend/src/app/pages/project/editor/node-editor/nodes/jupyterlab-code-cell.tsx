import { useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { useAwareness } from '@monorepo/collaborative-hooks';
import { useNode } from '@monorepo/demiurge-space';
import { TNodePython, TNodeCommon } from '@monorepo/demiurge-types';
import { TEditor, bindEditor } from '@monorepo/collaborative-hooks';

import { NodeJupyterlabCodeCell } from '@monorepo/demiurge-ui-components';

import { useDispatcher } from '../../../model/collab-model-chunk';
import { JupyterlabCellOutput } from './jupyterlab-cell-output';

//

export const JupyterlabCodeCellNodeLogic = ({
  id,
  code,
  dkid,
  busy,
}: TNodeCommon & TNodePython) => {
  //

  const { awareness } = useAwareness();

  const useNodeValue = useNode();

  const dispatcher = useDispatcher();

  const editorRef = useRef<TEditor | null>(null);

  //

  const handleDeleteCell = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'delete-node',
      id,
    });
  }, [dispatcher, id]);

  //

  const handleEditorMount = useCallback(
    (editor: TEditor) => {
      editorRef.current = editor;
      awareness && bindEditor(awareness, id, editor, code);
    },
    [awareness, code, id]
  );

  //

  const handleClearOutput = () => {
    dispatcher.dispatch({
      type: 'clear-node-output',
      nid: id,
    });
  };

  //

  const handleExecute = () => {
    const code = editorRef.current?.getValue();
    if (code) {
      dispatcher.dispatch({
        type: 'execute-python-node',
        nid: id,
        code,
        dkid,
      });
    }
  };

  //

  useHotkeys(
    'shift+enter',
    () => {
      if (useNodeValue.selected) handleExecute();
    },
    {},
    [useNodeValue.selected, handleExecute]
  );

  //

  return (
    <NodeJupyterlabCodeCell
      {...useNodeValue}
      code={code}
      busy={busy}
      onExecute={handleExecute}
      onClearOutput={handleClearOutput}
      onDelete={handleDeleteCell}
      onEditorMount={handleEditorMount}
    >
      <JupyterlabCellOutput nid={id} dkid={dkid} />
    </NodeJupyterlabCodeCell>
  );
};
