import { chmod, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { homedir } from 'node:os';
import { dirname, join } from 'node:path';

/**
 * Where the runner token lives on disk.
 *
 * A year-long token in a file is the one secret this program keeps, so the file
 * is created 0600 and the directory 0700 — on a shared machine, a token
 * readable by other accounts is a machine they can place services on.
 *
 * Explicitly not in the project directory and not an environment variable: an
 * env var is inherited by every child process this runner spawns, which
 * includes every container it starts.
 */

export type TRunnerCredentials = {
  /** Where this runner is enrolled, so one machine can serve several. */
  ganymedeUrl: string;
  runner_id: string;
  label: string;
  token: string;
};

export const credentialsPath = (): string =>
  process.env.HOLISTIX_RUNNER_HOME
    ? join(process.env.HOLISTIX_RUNNER_HOME, 'runner.json')
    : join(homedir(), '.holistix', 'runner.json');

export const readCredentials = async (
  path = credentialsPath()
): Promise<TRunnerCredentials | undefined> => {
  try {
    const raw = await readFile(path, 'utf8');
    const parsed = JSON.parse(raw) as Partial<TRunnerCredentials>;

    // A half-written file is treated as no credentials rather than as a
    // usable identity: the failure to fix is "run login again", and a token
    // with no runner_id beside it cannot be revoked from the UI either.
    if (!parsed.token || !parsed.runner_id || !parsed.ganymedeUrl) {
      return undefined;
    }

    return parsed as TRunnerCredentials;
  } catch {
    return undefined;
  }
};

export const writeCredentials = async (
  credentials: TRunnerCredentials,
  path = credentialsPath()
): Promise<void> => {
  await mkdir(dirname(path), { recursive: true, mode: 0o700 });
  // mode on writeFile applies at creation only, so an existing file keeps
  // whatever it had — chmod after the write covers both cases.
  await writeFile(path, JSON.stringify(credentials, null, 2), { mode: 0o600 });
  await chmod(path, 0o600);
};

export const clearCredentials = async (
  path = credentialsPath()
): Promise<void> => {
  await rm(path, { force: true });
};
