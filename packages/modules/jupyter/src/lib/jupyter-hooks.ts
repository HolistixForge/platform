import { useEffect } from 'react';
import type { TUserContainer } from '@holistix-forge/user-containers';
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

//

/**
 * Keep a container's kernels and terminals in the project's shared state for as
 * long as this component is showing it.
 *
 * The polling loop existed and was only ever started by the two creation forms,
 * so with no form open nothing polled: a terminal opened inside JupyterLab
 * never reached the project, and one closed there left a node pointing at
 * something gone. Measured — two terminals live in a container, zero
 * `jupyter:resources-changed` in the gateway.
 *
 * Reference-counted per container inside the manager, so several nodes showing
 * the same notebook cost one timer and the last of them to unmount stops it.
 *
 * `server` is read from shared state and is a fresh object on every change, so
 * the effect keys on its id — otherwise it would tear the subscription down and
 * build it up again on every poll it causes.
 */
export const useWatchedResources = (server?: TUserContainer) => {
  const jlsManager = useJLsManager();
  const id = server?.user_container_id;

  useEffect(() => {
    if (!server || !id) return;
    return jlsManager.watchResources(server);
    // `server` is deliberately not a dependency: it is read from shared state
    // and is a fresh object on every change, so keying on it would tear the
    // subscription down and rebuild it on every poll this very effect causes.
    // The id is what identifies the container.
  }, [jlsManager, id]);
};
