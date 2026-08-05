import { MICROVM_RUNTIMES } from './types';
import { TContainerEngine } from './engine';
import { buildRunArgs } from './run-args';
import { pullImage } from './pull';
import {
  ensureNetwork,
  attachToNetwork,
  detachFromNetwork,
  removeNetwork,
} from './networks';

/**
 * The Linux engine: Docker, with isolation borrowed from the runtime under it.
 *
 * Nothing here is new. It is the table of what the broker already did, so that
 * the second engine can be added without any of it moving: `run-args.ts`,
 * `pull.ts` and `networks.ts` are untouched and still hold the behaviour, and
 * this file only says which functions the Docker path is made of.
 *
 * Every control the design relies on exists here — `no-new-privileges`,
 * `--pids-limit`, `--restart`, `--pull=never`, a per-pull credential
 * directory, `network connect` on a running container — so it declares no
 * concessions. That empty list is what the Apple engine is measured against.
 */
export const dockerEngine: TContainerEngine = {
  name: 'docker',
  binary: 'docker',

  isMicroVm: (runtime) => MICROVM_RUNTIMES.includes(runtime),

  concessions: [],

  supportsExtraHosts: true,

  buildRunArgs,

  ownerOf: (exec, name) =>
    exec([
      'container',
      'inspect',
      '--format',
      '{{index .Config.Labels "holistix.user_container"}}',
      '--',
      name,
    ])
      .then((out) => out.trim())
      // Absent container, not a failure to report: the caller asks precisely
      // so it can act on "there is nothing in the way".
      .catch(() => ''),

  pullImage,

  ensureNetwork,
  attachToNetwork,
  detachFromNetwork,
  removeNetwork,

  removeContainer: async (exec, containerId) => {
    await exec(['rm', '--force', '--', containerId]);
  },

  // Nothing host-wide to establish: every credential this engine uses is
  // created per pull and deleted with it.
  preflight: async () => undefined,
};
