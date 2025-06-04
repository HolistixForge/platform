import { useCallback } from 'react';

import {
  InputsAndOutputs,
  DisableZoomDragPan,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space/frontend';
import { TGraphNode } from '@monorepo/core';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServersSharedData, TServer } from '@monorepo/servers';

import { KernelStateIndicator } from './kernel-state-indicator';
import {
  TJupyterServerData,
  TKernelNodeDataPayload,
} from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-shared-model-front';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';

//

export const NodeKernel = ({
  node,
}: {
  node: TGraphNode<TKernelNodeDataPayload>;
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

  const isExpanded = viewStatus.mode === 'EXPANDED';

  const { kernel_id, project_server_id } = node.data!;

  const kernelPack = useKernelPack(project_server_id, kernel_id);

  const s: { ps: TServer; js: TJupyterServerData } = useSharedData<
    TServersSharedData & TJupyterSharedData
  >(['jupyterServers', 'projectServers'], (sd) => {
    return {
      js: sd.jupyterServers.get(`${project_server_id}`),
      ps: sd.projectServers.get(`${project_server_id}`),
    };
  });

  const kernel = s.js?.kernels[kernel_id];

  const client_id = s.ps?.oauth.find(
    (o) => o.service_name === 'jupyterlab'
  )?.client_id;

  // console.log({ kernelPack, js: s.js, ps: s.ps, kernel, client_id });

  const dispatcher = useDispatcher<TDemiurgeNotebookEvent>();

  const handleDeleteKernel = useCallback(async () => {
    client_id &&
      (await dispatcher.dispatch({
        type: 'jupyter:delete-kernel-node',
        nodeId: id,
      }));
  }, [dispatcher, kernel_id, client_id]);

  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete: handleDeleteKernel,
    isOpened,
    open,
    close,
    filterOut,
  });

  //

  if (!kernelPack) return <>Not Found</>;

  return (
    <div className={`common-node kernel-node`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="kernel"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
        visible={selected}
      />
      {isOpened && (
        <DisableZoomDragPan noDrag>
          <div className="node-wrapper-body">
            <KernelStateIndicator state={kernelPack.state} />
            <div className="kernel-state-stopped">
              <p>
                kernel <b>{kernel?.name}</b>: {kernel?.type}
              </p>
              <span>{kernel?.execution_state}</span>
            </div>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
