import { DeepReadonly } from 'ts-essentials';
import { PathAndQuery } from './PathAndQuery';
import { JsonBody } from './JsonBody';
import { Env } from './Env';
import { Current } from './Current';
import { Cookie } from './Cookie';
import { InputSource } from './InputSource';
import { Request, TStringMap } from '../Request/Request';
import { ConfigException } from '../Exceptions/Exception';
import { Headers } from './Headers';
import { Gen } from './Gen';
import { TJson } from '@monorepo/simple-types';
import { Jwt } from './Jwt';
import { HmacToken } from './HmacToken';

//
//

export class Inputs {
  _inputSources: Array<InputSource>;

  constructor(envDev: DeepReadonly<TStringMap>) {
    this._inputSources = [
      new PathAndQuery(this),
      new JsonBody(this),
      new Env(this, envDev),
      new Current(this),
      new Cookie(this),
      new Headers(this),
      new Gen(this),
      new Jwt(this),
      new HmacToken(this),
    ];
  }

  //

  async evalInput(argId: string, request?: Request) {
    const regex = /('.*?'|[^.]+)/g;
    const [type, ...id] = argId.match(regex) ?? [];

    if (!type || !id || !id.length)
      throw new ConfigException(`unable to parse variable [${argId}]`);

    const idClean = id.map((match) => {
      if (match.startsWith("'") && match.endsWith("'")) {
        return match.slice(1, -1);
      }
      return match;
    });

    // console.log('------------------>', { type, id: idClean });

    for (let i = 0; i < this._inputSources.length; i++) {
      if (this._inputSources[i].types.includes(type))
        return await this._inputSources[i].get(type, idClean, request);
    }
    throw new ConfigException(`unknown type [${type}] in [${argId}]`);
  }

  //

  async cloneEvalArgs(
    o: DeepReadonly<TJson>,
    request?: Request
  ): Promise<TJson> {
    const evalMatch = async (match: string): Promise<TJson | undefined> => {
      const id = match.replace(/[{}]/g, '');
      const v = await this.evalInput(id, request);
      return v;
    };

    const evalString = async (s: string) => {
      let matchs;
      // if it has something to replace
      // matchs complex thing like "{json.pod_description.metadata.annotations.'hub.jupyter.org/username'}"
      while ((matchs = s.match(/{([a-zA-Z0-9_\-'/.*]*?)}/g)) && matchs.length) {
        // if arg is a single value
        if (matchs[0] === s) {
          const v = await evalMatch(matchs[0]);
          // we set it, recursively looking for variables in its properties
          if (v === undefined) return s;
          return this.cloneEvalArgs(v, request);
        } else {
          // else, multiple value to replace in this arg definition
          // we consider that this must be serialize as a string
          for (let i = 0; i < matchs.length; i++) {
            const m = matchs[i];
            const v = await evalMatch(m);
            // No: undefined is sometime a legit value !
            // if (v === undefined)
            // throw new EpDefinitionException(`input [${id}] does not exist`);
            s = s.replace(m, v as string);
          }
          return this.cloneEvalArgs(s, request);
        }
      }
      // else, it has not anything to replace just set the value
      return s;
    };

    if (typeof o === 'string') {
      return evalString(o);
    }
    //
    else if (Array.isArray(o)) {
      const _array_: Array<TJson> = [];
      for (let i = 0; i < o.length; i++) {
        _array_[i] = await this.cloneEvalArgs(o[i], request);
      }
      return _array_;
    }
    // because (warning) typeof null === 'object'
    else if (o === null) {
      return null;
    }
    //
    else if (typeof o === 'object') {
      // for each property in o...
      const r: TJson = {};
      for (const [key, value] of Object.entries(o)) {
        r[key] = await this.cloneEvalArgs(value, request);
      }
      return r;
    }
    // number, ...
    else return o;
  }

  //
  //
}
