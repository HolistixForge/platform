import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { OutputArea } from '@jupyterlab/outputarea';
import { Widget } from '@lumino/widgets';

import {
  useAwareness,
  useDispatcher,
  useBindEditor,
  useSharedData,
} from '@monorepo/collab-engine';
import { TCoreEvent, TGraphNode } from '@monorepo/core';
import {
  DisableZoomDragPan,
  InputsAndOutputs,
  NodeHeader,
  NodeMainToolbar,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { makeUuid } from '@monorepo/simple-types';
import { TServersSharedData, TServer } from '@monorepo/servers';

import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import { IOutput, TCell } from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-shared-model-front';
import CodeEditorMonaco from '../code-editor-monaco/code-editor-monaco';
import { BrowserWidgetManager } from '../../front/browser-widget-manager';
import { KernelStateIndicator } from '../node-kernel/kernel-state-indicator';

import './cell.scss';

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

  const kernelPack = useKernelPack(cell.dkid);

  const ps: TServer = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => {
      if (!kernelPack) return false;
      return sd.projectServers.get(`${kernelPack.project_server_id}`);
    }
  );

  const client_id = ps?.oauth?.find(
    (o) => o.service_name === 'jupyterlab'
  )?.client_id;

  const dispatcher = useDispatcher<TDemiurgeNotebookEvent | TCoreEvent>();

  const editorRef = useRef<any>(null);

  //

  const handleDeleteCell = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'jupyter:delete-cell',
      cellId,
    });
  }, [dispatcher, cellId]);

  //

  const bindEditor = useBindEditor();

  const handleEditorMount = useCallback(
    (editor: any) => {
      editorRef.current = editor;
      awareness && bindEditor('monaco', cellId, editor);
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
    if (code && client_id) {
      dispatcher.dispatch({
        type: 'jupyter:execute-python-node',
        cellId,
        code,
        dkid: cell.dkid,
        client_id,
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
    handleDeleteCell,
  };
};

//

export const Cell = ({ cellId }: { cellId: string }) => {
  const props = useCellLogic({ cellId, selected: false });

  return <CellInternal {...props} />;
};

//

const CellInternal = (props: ReturnType<typeof useCellLogic>) => {
  const { handleEditorMount } = props;
  const buttons = useMakeButton({
    onClear: props.handleClearOutput,
    onPlay: props.handleExecute,
  });

  return (
    <>
      <NodeMainToolbar buttons={buttons} />
      <div
        className={`jupyterlab-code-cell ${props.cell.busy && 'busy'}`}
        style={{ '--monaco-editor-height': '200px' } as React.CSSProperties}
      >
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

  const state = kernelPack ? kernelPack.state : 'not-found';
  const widgetManager = kernelPack ? kernelPack.widgetManager : null;

  useEffect(() => {
    if (kernelPack && kernelPack.state === 'widget-manager-loaded') {
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
  }, [state, widgetManager]);

  //

  // reload the widgets whenever the data changed
  useEffect(() => {
    if (oa) {
      oa.model.clear();
      const customOutput: IOutput[] = uuidInject(
        outputs as unknown as IOutput[]
      );
      oa.model.fromJSON(customOutput as any);
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

  if (!kernelPack) return <>Not Found</>;

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

export const NodeCell = ({ node }: { node: TGraphNode }) => {
  //
  const {
    id,
    viewStatus,
    expand,
    reduce,
    isOpened,
    open,
    close,
    selected,
    filterOut,
  } = useNodeContext();

  const cellLogic = useCellLogic({
    cellId: node.data!.cellId as string,
    selected,
  });

  const { handleClearOutput, handleExecute, handleDeleteCell } = cellLogic;

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
    onDelete: handleDeleteCell,
    filterOut,
  });

  return (
    <div className={`common-node node-resizable`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="python"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <CellInternal {...cellLogic} />
        </DisableZoomDragPan>
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
    uuidInject: (output: IOutput[]): IOutput[] => {
      return output.map((o) => ({
        ...o,
        // injected uid for use by js-renderer
        _demiurge_outputArea_uid: id,
      }));
    },
    uuid: id,
  };
};
