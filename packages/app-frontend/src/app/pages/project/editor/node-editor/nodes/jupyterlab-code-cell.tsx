import { useCallback, useRef } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';

import { useAwareness } from '@monorepo/collab-engine';
import { useNodeContext } from '@monorepo/space';
import { TEditor, bindEditor } from '@monorepo/collab-engine';
import { NodeJupyterlabCodeCell, TDKID } from '@monorepo/jupyter';

import { useDispatcher } from '../../../model/collab-model-chunk';
import { JupyterlabCellOutput } from './jupyterlab-cell-output';

//

export const JupyterlabCodeCellNodeLogic = ({
  id,
  cellId,
  code,
  dkid,
  busy,
}: {
  id: string;
  cellId: string;
  code: string;
  dkid: TDKID;
  busy: boolean;
}) => {
  //

  const { awareness } = useAwareness();

  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher();

  const editorRef = useRef<TEditor | null>(null);

  //

  const handleDeleteCell = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'core:delete-node',
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
      type: 'jupyter:clear-node-output',
      cellId,
    });
  };

  //

  const handleExecute = () => {
    const code = editorRef.current?.getValue();
    if (code) {
      dispatcher.dispatch({
        type: 'jupyter:execute-python-node',
        cellId,
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
