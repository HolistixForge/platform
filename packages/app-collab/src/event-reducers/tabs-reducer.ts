import { ReduceArgs, Reducer } from '@monorepo/collaborative';
import {
  MAX_TAB_ROW,
  ReadWriteTree,
  TabPath,
  TabPayload,
  TEventActiveTabChange,
  TEventAddTab,
  TEventConvertTabToGroup,
  TEventDeleteTab,
  TEventRenameTab,
  TTabEvents,
  TTabsSharedData,
  TUsersActiveTabs,
} from '@monorepo/demiurge-types';

/**
 *
 */

export type TTabsReducersExtraArgs = {
  user_id: string;
};

export type Ra<T> = ReduceArgs<
  TTabsSharedData,
  T,
  undefined,
  TTabsReducersExtraArgs
>;

/**
 *
 */

export class TabsReducer extends Reducer<
  TTabsSharedData,
  TTabEvents<TabPayload>,
  undefined,
  TTabsReducersExtraArgs
> {
  //

  reduce(g: Ra<TTabEvents<TabPayload>>): Promise<void> {
    switch (g.event.type) {
      case 'active-tab-change':
        return this._activeTabChange(g as Ra<TEventActiveTabChange>);
      case 'add-tab':
        return this._addTab(g as Ra<TEventAddTab<TabPayload>>);
      case 'delete-tab':
        return this._deleteTab(g as Ra<TEventDeleteTab>);
      case 'rename-tab':
        return this._renameTab(g as Ra<TEventRenameTab>);
      case 'convert-tab-to-group':
        return this._convertTabToGroup(g as Ra<TEventConvertTabToGroup>);

      default:
        return Promise.resolve();
    }
  }

  //

  __deepCopyEditAndApply(
    g: Ra<{}>,
    f: (t: ReadWriteTree<TabPayload>, a: TUsersActiveTabs) => void,
  ) {
    const o = g.sd.tabs.get('unique');
    if (o) {
      let no = structuredClone(o);
      const t = new ReadWriteTree<TabPayload>(no.tree);
      f(t, no.actives);
      g.sd.tabs.set('unique', { tree: t.get([], 0), actives: no.actives });
    }
  }

  _setActive(
    actives: TUsersActiveTabs,
    path: TabPath,
    user_id: string,
    old?: TabPath,
  ) {
    actives[user_id] = path;
    Object.keys(actives).forEach((key) => {
      if (JSON.stringify(actives[key]) === JSON.stringify(old)) {
        actives[key] = path;
      }
    });
  }

  //

  _activeTabChange(g: Ra<TEventActiveTabChange>): Promise<void> {
    this.__deepCopyEditAndApply(g, (t, actives) => {
      const { path } = g.event;
      this._setActive(actives, path, g.extraArgs.user_id);
    });
    return Promise.resolve();
  }

  //

  _addTab(g: Ra<TEventAddTab<TabPayload>>): Promise<void> {
    this.__deepCopyEditAndApply(g, (t, actives) => {
      let { path, title, payload } = g.event;
      const e = t.get(path, path.length);
      if (e) {
        const l = e.children.length;
        if (!title) title = `New ${l}`;
        t.insert([...path, title], payload || newTabPayload());
        this._setActive(actives, [...path, title], g.extraArgs.user_id);
      }
    });
    return Promise.resolve();
  }

  //

  _deleteTab(g: Ra<TEventDeleteTab>): Promise<void> {
    this.__deepCopyEditAndApply(g, (t, actives) => {
      const { path } = g.event;
      const newSelected = t.delete(path);
      if (newSelected)
        this._setActive(actives, newSelected, g.extraArgs.user_id, path);
    });
    return Promise.resolve();
  }

  //

  _renameTab(g: Ra<TEventRenameTab>): Promise<void> {
    this.__deepCopyEditAndApply(g, (t, actives) => {
      const { path, title } = g.event;
      t.update(path, { title });
      //
      const npath = [...path];
      npath[path.length - 1] = title;
      this._setActive(actives, npath, g.extraArgs.user_id, path);
    });
    return Promise.resolve();
  }

  //

  _convertTabToGroup(g: Ra<TEventConvertTabToGroup>): Promise<void> {
    this.__deepCopyEditAndApply(g, (t, actives) => {
      const { path } = g.event;
      if (path.length < MAX_TAB_ROW) {
        const initial = structuredClone(t.get(path, path.length));
        if (initial) {
          const newGroupTitle = 'Group X TODO';
          t.update(path, {
            payload: newGroup(),
            title: newGroupTitle,
            children: [initial],
          });
          const npath = [...path];
          npath.pop();
          this._setActive(
            actives,
            [...npath, newGroupTitle, initial.title],
            g.extraArgs.user_id,
            path,
          );
        }
      }
    });
    return Promise.resolve();
  }
}

//
//

const newTabPayload = (): TabPayload => ({
  type: 'node-editor',
  viewId: 'todo',
});

const newGroup = (): TabPayload => ({ type: 'group' });
