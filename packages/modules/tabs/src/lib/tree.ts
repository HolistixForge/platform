import { TabPath } from './tabs-types';

export type TreeElement<
  T = {
    /* */
  }
> = {
  title: string;
  children: TreeElement<T>[];
  payload: T;
};

//

export class ReadOnlyTree<
  T = {
    /* */
  }
> {
  protected _root: TreeElement<T>;

  constructor(c: TreeElement<T>) {
    this._root = c;
  }

  //

  get = (path: TabPath, depth: number) => {
    let e = this._root;
    for (let i = 0; i < depth; i++) {
      const next: TreeElement<T> | undefined = e.children.find(
        (o) => o.title === path[i]
      );
      if (!next) return undefined;
      e = next;
    }
    return e;
  };

  //

  flat = () => {
    type FlatElt = { path: TabPath } & T;

    const r: FlatElt[] = [];

    const recurse = (o: TreeElement<T>, path: TabPath) => {
      if (o.children.length === 0) {
        const t: FlatElt = { path, ...o.payload };

        const u = t as any;
        delete u.children;
        delete u.title;
        r.push(t);
      } else {
        for (let i = 0; i < o.children.length; i++) {
          recurse(o.children[i], [...path, o.children[i].title]);
        }
      }
    };

    recurse(this._root, []);
    return r;
  };
}

//

export class ReadWriteTree<T> extends ReadOnlyTree<T> {
  insert = (path: TabPath, d: T) => {
    let e = this._root;
    for (let i = 0; i < path.length; i++) {
      let next: TreeElement<T> | undefined = e.children.find(
        (o) => o.title === path[i]
      );
      if (!next) {
        next = { title: path[i], children: [], payload: d };
        e.children.push(next);
      }
      e = next;
    }
  };

  //

  /**
   * delete an element and return parent path
   * @param path
   * @returns
   */
  delete = (path: TabPath) => {
    const pp = [...path];
    const title = pp.pop();
    const parent = this.get(pp, pp.length);
    if (parent) {
      parent.children = parent.children.filter((c) => c.title !== title);

      return pp;
    }
    return undefined;
  };

  //

  update = (path: TabPath, d: Partial<TreeElement<T>>) => {
    const e = this.get(path, path.length);
    if (e) {
      Object.keys(d).forEach((k) => {
        (e as any)[k] = (d as any)[k];
      });
    }
  };
}
