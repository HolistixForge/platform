import {
  FrontendDispatcher,
  TValidSharedData,
  useExtraContext,
} from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';
import { useRegisterListener } from '@monorepo/simple-types';

import { JLsManager, TKernelPack } from './front/jls-manager';
import { TJupyterSharedData } from './jupyter-shared-model';
import { TDemiurgeNotebookEvent } from './jupyter-events';

//
type TServerExtraContext = {
  server: {
    getToken: (s: TServer) => Promise<string>;
  };
};

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
  dispatcher?: FrontendDispatcher<TDemiurgeNotebookEvent>;
  extraContext: object;
}): { jupyter: { jlsManager: JLsManager } } => {
  if (!dispatcher) throw new Error('dispatcher is required');
  return {
    jupyter: {
      jlsManager: new JLsManager(
        sharedData as TJupyterSharedData & TServersSharedData,
        dispatcher,
        (extraContext as TServerExtraContext).server.getToken
      ),
    },
  };
};

//

export const useJLsManager = () =>
  useExtraContext<{ jlsManager: JLsManager }>();

//

export const useKernelPack = (
  project_server_id: number,
  kernel_id: string
): TKernelPack | false => {
  const { jlsManager } = useJLsManager();
  useRegisterListener(jlsManager, kernel_id);

  const kernelPack = jlsManager.getKernelPack(project_server_id, kernel_id);

  return kernelPack;
};
