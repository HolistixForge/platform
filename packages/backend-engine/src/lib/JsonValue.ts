import { TJson } from '@monorepo/simple-types';

export class JsonValue {
  _v: TJson = {};

  constructor(jv?: TJson) {
    if (jv) {
      this._v = jv;
    }
  }

  get(key: Array<string>, create?: boolean): TJson | undefined {
    let ref: any = this._v;
    for (let i = 0; i < key.length; i++) {
      const property = key[i];
      if (!ref || ref[property] === undefined) {
        if (create) ref[property] = {};
        else return undefined;
      }
      ref = ref[property];
    }
    return ref;
  }

  _assignThrough(key: string, value: TJson) {
    const tokens = key.split('.');
    const prop = tokens.pop();
    if (prop) {
      let ref: any = this._v;
      if (tokens.length > 0) {
        ref = this.get(tokens, true);
        if (ref === undefined)
          throw new Error(`Undefined property going through [${key}]`);
      }
      ref[prop] = value;
    }
  }

  graft(point: string, value: TJson) {
    if (point === '.') {
      this._v = value;
    } else {
      if (point.charAt(0) === '.') point = point.substr(1);
      this._assignThrough(point, value);
    }
  }

  get value() {
    return this._v;
  }
}
