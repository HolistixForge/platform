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
} from '@monorepo/space/frontend';
import { makeUuid } from '@monorepo/simple-types';
import { TServersSharedData, TServer } from '@monorepo/servers';

import { TDemiurgeNotebookEvent } from '../../jupyter-events';
import { IOutput, Cell, TCellNodeDataPayload } from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-shared-model-front';
import CodeEditorMonaco from '../code-editor-monaco/code-editor-monaco';
import { BrowserWidgetManager } from '../../front/browser-widget-manager';
import { KernelStateIndicator } from '../node-kernel/kernel-state-indicator';

import './cell.scss';

//

export const useCellLogic = ({
  projectServerId,
  cellId,
  selected,
}: {
  projectServerId: number;
  cellId: string;
  selected: boolean;
}) => {
  //

  const { awareness } = useAwareness();

  const cell: Cell = useSharedData<TJupyterSharedData>(
    ['jupyterServers'],
    (sd) => sd.jupyterServers.get(`${projectServerId}`)?.cells[cellId]
  );

  const ps: TServer = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => sd.projectServers.get(`${projectServerId}`)
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
      cell_id: cellId,
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
      cell_id: cellId,
    });
  };

  //

  const handleExecute = () => {
    const code = editorRef.current?.getValue();
    if (code && client_id) {
      dispatcher.dispatch({
        type: 'jupyter:execute-python-node',
        cell_id: cellId,
        code,
        kernel_id: cell.kernel_id,
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
    projectServerId,
    cell,
    handleEditorMount,
    handleClearOutput,
    handleExecute,
    handleDeleteCell,
  };
};

//

export const CellStory = ({
  cellId,
  projectServerId,
}: {
  cellId: string;
  projectServerId: number;
}) => {
  const props = useCellLogic({ cellId, projectServerId, selected: false });
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

  const kernelPack = useKernelPack(props.projectServerId, props.cell.kernel_id);

  const { uuid, uuidInject } = useMemo(() => uuidInjecter(), []);

  const [oa, setOa] = useState<OutputArea | null>(null);

  const widgetManager = kernelPack ? kernelPack.widgetManager : null;

  useEffect(() => {
    if (widgetManager) {
      const newOA = (widgetManager as BrowserWidgetManager).createOutputArea();
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
  }, [widgetManager]);

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
      <KernelStateIndicator state={kernelPack.state} />
      {oa && (
        <div id={uuid} className="jupyter-output-area-box">
          <div className="cell-output" ref={handleDivMount} />
        </div>
      )}
    </div>
  );
};

//

export const NodeCell = ({
  node,
}: {
  node: TGraphNode<TCellNodeDataPayload>;
}) => {
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
    cellId: node.data!.cell_id as string,
    projectServerId: node.data!.project_server_id,
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
