import {
  FrontendDispatcher,
  TValidSharedData,
  useExtraContext,
} from '@monorepo/collab-engine';
import { TServersSharedData } from '@monorepo/user-containers';
import { TServersExtraContext } from '@monorepo/user-containers/frontend';
import { useRegisterListener } from '@monorepo/simple-types';

import { JLsManager, TKernelPack } from './front/jls-manager';
import { TJupyterSharedData } from './jupyter-shared-model';
import { TJupyterEvent } from './jupyter-events';

//

export type TJupyterExtraContext = {
  jupyter: {
    jlsManager: JLsManager;
  };
};

export const Jupyter_Load_Frontend_ExtraContext = ({
  sharedData,
  dispatcher,
  extraContext,
}: {
  sharedData: TValidSharedData;
  dispatcher?: FrontendDispatcher<TJupyterEvent>;
  extraContext: object;
}): { jupyter: { jlsManager: JLsManager } } => {
  if (!dispatcher) throw new Error('dispatcher is required');
  return {
    jupyter: {
      jlsManager: new JLsManager(
        sharedData as TJupyterSharedData & TServersSharedData,
        dispatcher,
        (extraContext as TServersExtraContext).servers.getToken
      ),
    },
  };
};

//

export const useJLsManager = () =>
  useExtraContext<{ jupyter: { jlsManager: JLsManager } }>();

//

export const useKernelPack = (
  user_container_id: number,
  kernel_id: string
): TKernelPack | false => {
  const { jupyter } = useJLsManager();
  useRegisterListener(jupyter.jlsManager, kernel_id);

  const kernelPack = jupyter.jlsManager.getKernelPack(
    user_container_id,
    kernel_id
  );

  return kernelPack;
};
