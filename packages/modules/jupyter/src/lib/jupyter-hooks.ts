import { useRegisterListener } from '@holistix-forge/ui-toolkit/frontend';

import { JLsManager, TKernelPack } from './front/jls-manager';
import { useModuleExports } from '@holistix-forge/module/frontend';
import { TJupyterFrontendExports } from '../frontend';

//

export const useJLsManager = (): JLsManager =>
  useModuleExports<{ jupyter: TJupyterFrontendExports }>().jupyter.jlsManager;

//

export const useKernelPack = (
  user_container_id: string,
  kernel_id: string
): TKernelPack | false => {
  const jlsManager = useJLsManager();
  useRegisterListener(jlsManager, kernel_id);
  const kernelPack = jlsManager.getKernelPack(user_container_id, kernel_id);
  return kernelPack;
};
