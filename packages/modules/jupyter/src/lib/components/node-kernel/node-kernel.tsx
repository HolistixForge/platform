import { useCallback } from 'react';

import {
  InputsAndOutputs,
  DisableZoomDragPan,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space/frontend';
import { ButtonBase, useAction } from '@monorepo/ui-base';
import { TGraphNode } from '@monorepo/core';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';
import { TServersSharedData, TServer } from '@monorepo/servers';

import { KernelStateIndicator } from './kernel-state-indicator';
import { TDKID, TJupyterServerData } from '../../jupyter-types';
import { TJupyterSharedData } from '../../jupyter-shared-model';
import { useKernelPack } from '../../jupyter-shared-model-front';
import { greaterThan } from '../../front/jls-manager';
import { TDemiurgeNotebookEvent } from '../../jupyter-events';

//

export const NodeKernel = ({ node }: { node: TGraphNode }) => {
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

  const dkid = node.data!.dkid as TDKID;

  const kernelPack = useKernelPack(dkid);

  const s: { ps: TServer; js: TJupyterServerData } = useSharedData<
    TServersSharedData & TJupyterSharedData
  >(['jupyterServers', 'projectServers'], (sd) => {
    if (!kernelPack) return false;
    return {
      js: sd.jupyterServers.get(`${kernelPack.project_server_id}`),
      ps: sd.projectServers.get(`${kernelPack.project_server_id}`),
    };
  });

  const kernel = s.js?.kernels.find((k) => k.dkid === dkid);

  const client_id = s.ps?.oauth.find(
    (o) => o.service_name === 'jupyterlab'
  )?.client_id;

  // console.log({ kernelPack, js: s.js, ps: s.ps, kernel, client_id });

  const dispatcher = useDispatcher<TDemiurgeNotebookEvent>();

  const handleDeleteKernel = useCallback(async () => {
    client_id &&
      (await dispatcher.dispatch({
        type: 'jupyter:delete-kernel',
        dkid,
        client_id,
      }));
  }, [dispatcher, dkid, client_id]);

  const startButton = useAction(async () => {
    client_id &&
      (await dispatcher.dispatch({
        type: 'jupyter:start-kernel',
        dkid,
        client_id,
      }));
  }, [dispatcher, dkid, client_id]);

  const stopButton = useAction(async () => {
    client_id &&
      dispatcher.dispatch({
        type: 'jupyter:stop-kernel',
        dkid,
        client_id,
      });
  }, [dispatcher, dkid, client_id]);

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

  let state: 'kernel-started' | 'kernel-stopped' | 'server-stopped' =
    'server-stopped';
  let startStopButton = undefined;

  if (kernelPack && greaterThan(kernelPack.state, 'server-started')) {
    state = 'kernel-started';
    startStopButton = { ...stopButton, text: 'Stop' };
  } else if (kernelPack && greaterThan(kernelPack.state, 'server-stopped')) {
    state = 'kernel-stopped';
    startStopButton = { ...startButton, text: 'Start' };
  } else state = 'server-stopped';

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
            <KernelStateIndicator
              startState={kernelPack.state}
              StartProgress={kernelPack.progress}
            />
            <div className="kernel-state-stopped">
              <p>
                kernel <b>{kernel?.kernelName}</b>: {kernel?.kernelType}
              </p>
              <span>
                {state === 'kernel-started'
                  ? 'started'
                  : state === 'kernel-stopped'
                  ? 'stopped'
                  : null}
              </span>
              {startStopButton && (
                <ButtonBase
                  {...startStopButton}
                  className="small blue"
                  style={{ marginLeft: '10px', width: '40px' }}
                />
              )}
            </div>
          </div>
        </DisableZoomDragPan>
      )}
    </div>
  );
};
