import { DeepReadonly } from 'ts-essentials';
import { development } from '../debug';
import { Request, TStringMap } from '../Request/Request';
import { InputSource } from './InputSource';
import { Inputs } from './Inputs';

export class Env extends InputSource {
  _envDev: TStringMap = {};

  constructor(i: Inputs, envDev?: DeepReadonly<TStringMap>) {
    super(i);
    if (envDev) {
      this._envDev = envDev;
    }
  }

  get types() {
    return ['env'];
  }

  get(
    type: string,
    id: string[],
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    r?: Request
  ): string | undefined {
    let v = undefined;
    const envName = id[0];

    switch (type) {
      case 'env':
        v = Env.getenv(envName, this._envDev);
    }
    return v;
  }

  static getenv(envName: string, envDev?: TStringMap) {
    let v: string | undefined = undefined;
    v = process.env[envName];
    development(() => {
      if (!v && envDev) {
        v = envDev[envName];
      }
    });
    return v;
  }
}
