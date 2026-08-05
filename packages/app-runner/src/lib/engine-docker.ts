import {
  connectNetwork,
  disconnectNetwork,
  ensureNetwork,
  listOwned,
  removeContainer,
  startExisting,
  stopContainer,
} from './docker';
import { TRunnerEngine } from './engine';
import { runArgs } from './reconcile';

/**
 * Docker, exactly as it was.
 *
 * Every entry names a function that already existed and is unchanged. Nothing
 * on this path behaves differently for having an engine table above it — that
 * is the point of writing the table this way rather than refactoring the
 * callers into something both engines could share.
 *
 * No concessions: Docker expresses every control the runner uses.
 */
export const dockerEngine: TRunnerEngine = {
  name: 'docker',
  binary: 'docker',
  // Depends on what is underneath — runc shares the host kernel, and on macOS
  // every container shares the single Docker VM's kernel. Claiming a microVM
  // here would be claiming an isolation nobody arranged.
  isMicroVm: false,
  concessions: [],

  listOwned,
  ensureNetwork,
  connectNetwork,
  disconnectNetwork,
  startExisting,
  stopContainer,
  removeContainer,
  runArgs,
};
