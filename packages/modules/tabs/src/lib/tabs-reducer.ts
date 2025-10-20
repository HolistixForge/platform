import { ReduceArgs, Reducer } from '@monorepo/collab-engine';
import { TEventLoad } from '@monorepo/core-graph';

import {
  TEventActiveTabChange,
  TEventAddTab,
  TEventConvertTabToGroup,
  TEventDeleteTab,
  TEventRenameTab,
  TTabEvents,
} from './tabs-event';
import {
  MAX_TAB_ROW,
  TabPath,
  TabPayload,
  TTabsTree,
  TUsersActiveTabs,
} from './tabs-types';
import { TTabsSharedData } from './tabs-shared-model';
import { ReadWriteTree } from './tree';

/**
 *
 */

type TExtraArgs = {
  user_id: string;
};

type Ra<T> = ReduceArgs<
  TTabsSharedData,
  T,
  Record<string, never>,
  TExtraArgs,
  undefined
>;

/**
 *
 */

export class TabsReducer extends Reducer<
  TTabsSharedData,
  TTabEvents<TabPayload> | TEventLoad,
  Record<string, never>,
  TExtraArgs,
  undefined
> {
  //

  reduce(g: Ra<TTabEvents<TabPayload> | TEventLoad>): Promise<void> {
    switch (g.event.type) {
      case 'tabs:active-tab-change':
        return this._activeTabChange(g as Ra<TEventActiveTabChange>);
      case 'tabs:add-tab':
        return this._addTab(g as Ra<TEventAddTab<TabPayload>>);
      case 'tabs:delete-tab':
        return this._deleteTab(g as Ra<TEventDeleteTab>);
      case 'tabs:rename-tab':
        return this._renameTab(g as Ra<TEventRenameTab>);
      case 'tabs:convert-tab-to-group':
        return this._convertTabToGroup(g as Ra<TEventConvertTabToGroup>);
      case 'core:load':
        return this._load(g as Ra<TEventLoad>);

      default:
        return Promise.resolve();
    }
  }

  //

  _load(g: Ra<TEventLoad>) {
    if (!g.sd['tabs:tabs'].get('unique')) {
      g.sd['tabs:tabs'].set('unique', {
        tree: {
          payload: { type: 'group' },
          title: 'root',
          children: [],
        },
        actives: {},
      });
    }
    return Promise.resolve();
  }

  //

  __deepCopyEditAndApply(
    g: Ra<{}>,
    f: (t: ReadWriteTree<TabPayload>, a: TUsersActiveTabs) => void
  ) {
    const o = g.sd['tabs:tabs'].get('unique') as TTabsTree;
    if (o) {
      let no = structuredClone(o);
      const trw = new ReadWriteTree<TabPayload>(no.tree);
      f(trw, no.actives);
      g.sd['tabs:tabs'].set('unique', {
        tree: trw.get([], 0)!,
        actives: no.actives,
      });
    }
  }

  _setActive(
    actives: TUsersActiveTabs,
    path: TabPath,
    user_id: string,
    old?: TabPath
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
            path
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
