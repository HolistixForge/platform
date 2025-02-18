import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { OutputArea } from '@jupyterlab/outputarea';
import { Widget } from '@lumino/widgets';

import {
  useAwareness,
  useDispatcher,
  TEditor,
  bindEditor,
  useSharedData,
} from '@monorepo/collab-engine';
import { TCoreEvent } from '@monorepo/core';
import {
  DisablePanSelect,
  InputsAndOutputs,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { makeUuid } from '@monorepo/simple-types';

import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import { IOutput, TCell } from '../../jupyter-types';
import { TJupyterSharedData, useKernelPack } from '../../jupyter-shared-model';
import CodeEditorMonaco from '../code-editor-monaco/code-editor-monaco';
import { BrowserWidgetManager } from '../../front/browser-widget-manager';
import { KernelStateIndicator } from '../node-kernel/kernel-state-indicator';

//

export const useCellLogic = ({
  cellId,
  selected,
}: {
  cellId: string;
  selected: boolean;
}) => {
  //

  const { awareness } = useAwareness();

  const cell: TCell = useSharedData<TJupyterSharedData>(['cells'], (sd) =>
    sd.cells.get(cellId)
  );

  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TCoreEvent>();

  const editorRef = useRef<TEditor | null>(null);

  //
  /*
  const handleDeleteCell = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'core:delete-node',
      id,
    });
  }, [dispatcher, id]);
  */

  //

  const handleEditorMount = useCallback(
    (editor: TEditor) => {
      editorRef.current = editor;
      awareness && bindEditor(awareness, cellId, editor, '');
    },
    [awareness, cellId]
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
        dkid: cell.dkid,
      });
    }
  };

  //

  useHotkeys(
    'shift+enter',
    () => {
      if (selected) handleExecute();
    },
    {},
    [selected, handleExecute]
  );

  return {
    cell,
    handleEditorMount,
    handleClearOutput,
    handleExecute,
  };
};

/*

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
*/

export const Cell = ({ cellId }: { cellId: string }) => {
  const props = useCellLogic({ cellId, selected: false });

  return <CellInternal {...props} />;
};

//

const CellInternal = (props: ReturnType<typeof useCellLogic>) => {
  const { handleEditorMount } = props;
  return (
    <>
      <div className="node-wrapper-body jupyterlab-code-cell">
        <CodeEditorMonaco code={''} onMount={handleEditorMount} />
      </div>
      <CellOutput {...props} />
    </>
  );
};

//

const CellOutput = (props: ReturnType<typeof useCellLogic>) => {
  const { outputs } = props.cell;

  const kernelPack = useKernelPack(props.cell.dkid);

  const { uuid, uuidInject } = useMemo(() => uuidInjecter(), []);

  const [oa, setOa] = useState<OutputArea | null>(null);

  // if kernel readyness is true, or change from false to true,
  // create a new outputArea.
  // else reset to null to render a information message
  useEffect(() => {
    if (kernelPack.state === 'widget-manager-loaded') {
      const newOA = (
        kernelPack.widgetManager as BrowserWidgetManager
      ).createOutputArea();
      setOa((prev) => {
        prev?.dispose();
        return newOA;
      });
    } else {
      setOa((prev) => {
        prev?.dispose();
        return null;
      });
    }
  }, [kernelPack.state, kernelPack.widgetManager]);

  //

  // reload the widgets whenever the data changed
  useEffect(() => {
    if (oa) {
      oa.model.clear();
      const customOutput = uuidInject(outputs);
      oa.model.fromJSON(customOutput);
    }
  }, [oa, outputs, uuidInject]);

  //

  const handleDivMount = useCallback(
    (div: HTMLDivElement) => {
      // nominal, widget is attached to a mounted div
      if (!oa || (oa.isAttached && oa.node.isConnected)) return;

      // else, we have to attach widget if everything is ready
      if (oa && oa.node && div && div.isConnected) Widget.attach(oa, div);
    },
    [oa]
  );

  //

  return (
    <div>
      <KernelStateIndicator
        StartProgress={kernelPack.progress}
        startState={kernelPack.state}
      />
      {oa && (
        <div id={uuid} className="jupyter-output-area-box">
          <div className="cell-output" ref={handleDivMount} />
        </div>
      )}
    </div>
  );
};

//

export const NodeCell = ({ cellId }: { cellId: string }) => {
  //
  const { id, viewStatus, expand, reduce, isOpened, open, close, selected } =
    useNodeContext();

  const cellLogic = useCellLogic({ cellId: id, selected });

  const { cell, handleClearOutput, handleExecute } = cellLogic;

  const isExpanded = viewStatus.mode === 'EXPANDED';
  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    isOpened,
    open,
    close,
    onClear: handleClearOutput,
    onPlay: handleExecute,
  });

  return (
    <div
      className={`common-node node-jupyterlab-code-cell ${cell.busy && 'busy'}`}
    >
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
          <CellInternal {...cellLogic} />
        </DisablePanSelect>
      )}
    </div>
  );
};

//

/**
 * create and return a function that inject a `_demiurge_outputArea_uid` field
 * in all object of an array.
 * it is use to wrap output area in a div with a known unique id.
 * this div is used by Javascript widget renderer to owerload
 * document.getElementById like call in the render code.
 * @returns
 */
const uuidInjecter = () => {
  const id = makeUuid();
  return {
    uuidInject: (output: IOutput[]) => {
      return output.map((o) => ({
        ...o,
        // injected uid for use by js-renderer
        _demiurge_outputArea_uid: id,
      }));
    },
    uuid: id,
  };
};
