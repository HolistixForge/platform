import { spawnSync } from 'child_process';
import { RunException } from '@monorepo/backend-engine';
import { TJson } from '@monorepo/simple-types';
import { CONFIG } from './config';

//

type EScripts = 'update-nginx-locations' | 'reset-gateway';

//

export const runScript = (name: EScripts, inputString?: string) => {
  const DIR = CONFIG.SCRIPTS_DIR;
  const cmd = `${DIR}/main.sh`;
  const args = ['-r', `bin/${name}.sh`];

  const fcmd = `${cmd} ${args.join(' ')}`;

  let output;

  try {
    const result = spawnSync(
      cmd,
      args,
      inputString ? { input: inputString } : undefined
    );
    if (result.error) {
      throw new RunException(
        `Error executing [${fcmd}]: ${result.error.message}`
      );
    }
    output = result.stdout.toString();
  } catch (err: any) {
    throw new RunException(`Error executing [${fcmd}]: ${err.message}`);
  }
  let json;
  try {
    json = JSON.parse(output);
  } catch (error) {
    throw new RunException(
      `Error executing [${fcmd}]: not a JSON output [[[${output}]]]`
    );
  }
  if (json.status === 'error') {
    throw new RunException(`Error executing script [${name}]: ${json.error}`);
  } else if (json.status === 'ok') return json as TJson;
  else
    throw new RunException(
      `Error executing [${fcmd}]: invalid output status format [${json.status}]`
    );
};
