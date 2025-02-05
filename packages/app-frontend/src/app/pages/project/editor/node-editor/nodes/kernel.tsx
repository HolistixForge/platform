import { useCallback } from 'react';

import { TNodeKernel } from '@monorepo/demiurge-types';
import { useNodeContext } from '@monorepo/space';
import { useAction } from '@monorepo/demiurge-ui-components';
import { NodeKernel } from '@monorepo/jupyter';

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
}: TNodeCommon & TNodeKernel) => {
  //
  const useNodeValue = useNodeContext();

  const serverData = useSharedData(['projectServers'], (sd) => {
    return sd.projectServers.get(`${project_server_id}`);
  });

  const kernel =
    serverData?.type === 'jupyter'
      ? serverData?.kernels.find((k) => k.dkid === dkid)
      : undefined;

  const kernelPack = useKernelPack(dkid);

  const dispatcher = useDispatcher();

  const handleDeleteKernel = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'delete-kernel',
      dkid,
    });
  }, [dispatcher, dkid]);

  const startButton = useAction(async () => {
    await dispatcher.dispatch({
      type: 'start-kernel',
      dkid,
    });
  }, [dispatcher, dkid]);

  const stopButton = useAction(async () => {
    dispatcher.dispatch({
      type: 'stop-kernel',
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
