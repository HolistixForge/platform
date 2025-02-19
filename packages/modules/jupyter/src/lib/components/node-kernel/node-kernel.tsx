import { useCallback } from 'react';

import {
  InputsAndOutputs,
  DisablePanSelect,
  NodeHeader,
  useMakeButton,
  useNodeContext,
} from '@monorepo/space';
import { ButtonBase, useAction } from '@monorepo/ui-base';
import { TGraphNode } from '@monorepo/core';
import { useDispatcher, useSharedData } from '@monorepo/collab-engine';

import { KernelStateIndicator } from './kernel-state-indicator';
import { TDKID, TJupyterServerData } from '../../jupyter-types';
import { TJupyterSharedData, useKernelPack } from '../../jupyter-shared-model';
import { greaterThan } from '../../front/jls-manager';

//

export const NodeKernel = ({ node }: { node: TGraphNode }) => {
  //

  const { id, viewStatus, expand, reduce, isOpened, open, close } =
    useNodeContext();

  const isExpanded = viewStatus.mode === 'EXPANDED';

  const dkid = node.data!.dkid as TDKID;

  const kernelPack = useKernelPack(dkid);

  const serverData: TJupyterServerData = useSharedData<TJupyterSharedData>(
    ['jupyterServers'],
    (sd) => {
      return sd.jupyterServers.get(`${kernelPack.project_server_id}`);
    }
  );

  const kernel = serverData?.kernels.find((k) => k.dkid === dkid);

  const dispatcher = useDispatcher();

  const handleDeleteKernel = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'jupyter:delete-kernel',
      dkid,
    });
  }, [dispatcher, dkid]);

  const startButton = useAction(async () => {
    await dispatcher.dispatch({
      type: 'jupyter:start-kernel',
      dkid,
    });
  }, [dispatcher, dkid]);

  const stopButton = useAction(async () => {
    dispatcher.dispatch({
      type: 'jupyter:stop-kernel',
      dkid,
    });
  }, [dispatcher, dkid]);

  const buttons = useMakeButton({
    isExpanded,
    expand,
    reduce,
    onDelete: handleDeleteKernel,
    isOpened,
    open,
    close,
  });

  //

  let state: 'kernel-started' | 'kernel-stopped' | 'server-stopped' =
    'server-stopped';
  let startStopButton = undefined;

  if (greaterThan(kernelPack.state, 'server-started')) {
    state = 'kernel-started';
    startStopButton = { ...stopButton, text: 'Stop' };
  } else if (greaterThan(kernelPack.state, 'server-stopped')) {
    state = 'kernel-stopped';
    startStopButton = { ...startButton, text: 'Start' };
  } else state = 'server-stopped';

  return (
    <div className={`common-node kernel-node`}>
      <InputsAndOutputs id={id} />
      <NodeHeader
        nodeType="kernel"
        id={id}
        isOpened={isOpened}
        open={open}
        buttons={buttons}
      />
      {isOpened && (
        <DisablePanSelect>
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
        </DisablePanSelect>
      )}
    </div>
  );
};
