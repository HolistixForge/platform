import { FrontendDispatcher, useExtraContext } from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';
import { useRegisterListener } from '@monorepo/simple-types';

import { JLsManager, TKernelPack } from './front/jls-manager';
import { TJupyterSharedData } from './jupyter-shared-model';
import { TDemiurgeNotebookEvent } from './jupyter-events';

//

export const Jupyter_Load_Frontend_ExtraContext = (
  sd: TJupyterSharedData & TServersSharedData,
  dispatcher: FrontendDispatcher<TDemiurgeNotebookEvent>,
  getToken: (s: TServer) => Promise<string>
): { jlsManager: JLsManager } => {
  return {
    jlsManager: new JLsManager(sd, dispatcher, getToken),
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
