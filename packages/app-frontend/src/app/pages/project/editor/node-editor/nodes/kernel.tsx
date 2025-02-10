import { useCallback } from 'react';

import { useNodeContext } from '@monorepo/space';
import { useAction } from '@monorepo/ui-base';
import { NodeKernel, TDKID } from '@monorepo/jupyter';

import { greaterThan } from '../../../jl-integration/jls-manager';
import {
  useDispatcher,
  useKernelPack,
  useSharedData,
} from '../../../model/collab-model-chunk';

//
//
//

export const KernelNodeLogic = ({
  dkid,
  project_server_id,
}: {
  project_server_id: number;
  dkid: TDKID;
}) => {
  //
  const useNodeValue = useNodeContext();

  const serverData = useSharedData(['jupyterServers'], (sd) => {
    return sd.jupyterServers.get(`${project_server_id}`);
  });

  const kernel = serverData?.kernels.find((k) => k.dkid === dkid);

  const kernelPack = useKernelPack(dkid);

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
    <NodeKernel
      {...useNodeValue}
      state={state}
      kernelName={kernel?.kernelName || ''}
      kernelType={kernel?.kernelType || ''}
      startStopButton={startStopButton}
      StartProgress={kernelPack.progress}
      startState={kernelPack.state}
      onDelete={handleDeleteKernel}
    />
  );
};
