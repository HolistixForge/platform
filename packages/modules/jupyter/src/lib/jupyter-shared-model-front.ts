import { useExtraContext } from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';
import { useRegisterListener } from '@monorepo/simple-types';

import { TDKID } from './jupyter-types';
import { JLsManager, TKernelPack } from './front/jls-manager';
import { TJupyterSharedData } from './jupyter-shared-model';

//

export const Jupyter_Load_Frontend_ExtraContext = (
  sd: TJupyterSharedData & TServersSharedData,
  getToken: (s: TServer) => Promise<string>
): { jlsManager: JLsManager } => {
  return {
    jlsManager: new JLsManager(sd, getToken),
  };
};

//

export const useJLsManager = () =>
  useExtraContext<{ jlsManager: JLsManager }>();

//

export const useKernelPack = (dkid: TDKID): TKernelPack => {
  const { jlsManager } = useJLsManager();
  useRegisterListener(jlsManager, dkid);

  const kernelPack = jlsManager.getKernelPack(dkid);

  return kernelPack;
};
