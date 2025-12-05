import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import { OutputArea } from '@jupyterlab/outputarea';
import { Widget } from '@lumino/widgets';

import {
  useAwareness,
  useBindEditor,
  useLocalSharedData,
} from '@holistix-forge/collab/frontend';
import { TGraphNode, TCoreEvent } from '@holistix-forge/core-graph';
import {
  DisableZoomDragPan,
  InputsAndOutputs,
  NodeHeader,
  NodeMainToolbar,
  useMakeButton,
  useNodeContext,
  useNodeHeaderButtons,
} from '@holistix-forge/whiteboard/frontend';
import { makeUuid } from '@holistix-forge/simple-types';
import {
  TUserContainersSharedData,
  TUserContainer,
} from '@holistix-forge/user-containers';
import { useDispatcher } from '@holistix-forge/reducers/frontend';

import { TJupyterEvent } from '../../jupyter-events';
import {
  IOutput,
  Cell,
  TCellNodeDataPayload,
  TJupyterServerData,
} from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-hooks';
import CodeEditorMonaco from '../code-editor-monaco/code-editor-monaco';
import { BrowserWidgetManager } from '../../front/browser-widget-manager';
import { KernelStateIndicator } from '../node-kernel/kernel-state-indicator';
import * as nbformat from '@jupyterlab/nbformat';

import './cell.scss';

//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type TEditor = any;

export const useCellLogic = ({
  userContainerId,
  cellId,
  selected,
}: {
  userContainerId: string;
  cellId: string;
  selected: boolean;
}) => {
  //

  const { awareness } = useAwareness();

  const jupyter: TJupyterServerData | undefined =
    useLocalSharedData<TJupyterSharedData>(['jupyter:servers'], (sd) =>
      sd['jupyter:servers'].get(`${userContainerId}`)
    );

  const cell = jupyter?.cells[cellId];

  const ps: TUserContainer | undefined =
    useLocalSharedData<TUserContainersSharedData>(
      ['user-containers:containers'],
      (sd) => sd['user-containers:containers'].get(`${userContainerId}`)
    );

  const client_id = ps?.oauth?.find(
    (o) => o.service_name === 'jupyterlab'
  )?.client_id;

  const dispatcher = useDispatcher<TJupyterEvent | TCoreEvent>();

  const editorRef = useRef<TEditor | null>(null);

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
    (editor: TEditor) => {
      editorRef.current = editor;
      awareness && bindEditor('monaco', cellId, editor);
    },
    [awareness, bindEditor, cellId]
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
    if (code && client_id && cell) {
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
    userContainerId,
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
  userContainerId,
}: {
  cellId: string;
  userContainerId: string;
}) => {
  const props = useCellLogic({ cellId, userContainerId, selected: false });
  return <CellInternal {...props} />;
};

//

const CellInternal = (props: ReturnType<typeof useCellLogic>) => {
  const { handleEditorMount } = props;
  const buttons = useMakeButton({
    onClear: props.handleClearOutput,
    onPlay: props.handleExecute,
  });

  if (!props.cell) return <div>Not Found</div>;

  return (
    <>
      <NodeMainToolbar buttons={buttons} />
      <div
        className={`jupyterlab-code-cell ${props.cell.busy && 'busy'}`}
        style={
          {
            minWidth: '300px',
            '--monaco-editor-height': '200px',
          } as React.CSSProperties
        }
      >
        <CodeEditorMonaco code={''} onMount={handleEditorMount} />
      </div>
      <CellOutput cell={props.cell} userContainerId={props.userContainerId} />
    </>
  );
};

//

const CellOutput = (props: { cell: Cell; userContainerId: string }) => {
  const { outputs } = props.cell;

  const kernelPack = useKernelPack(props.userContainerId, props.cell.kernel_id);

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
      oa.model.fromJSON(customOutput as unknown as nbformat.IOutput[]);
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
  const { id, isOpened, open, selected } = useNodeContext();

  const { cell_id, user_container_id } = node.data as TCellNodeDataPayload;

  const cellLogic = useCellLogic({
    cellId: cell_id,
    userContainerId: user_container_id,
    selected,
  });

  const { handleClearOutput, handleExecute, handleDeleteCell } = cellLogic;

  const buttons = useNodeHeaderButtons({
    onDelete: handleDeleteCell,
    onClear: handleClearOutput,
    onPlay: handleExecute,
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
 * create and return a function that inject a `__outputArea_uid` field
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
        __outputArea_uid: id,
      }));
    },
    uuid: id,
  };
};
