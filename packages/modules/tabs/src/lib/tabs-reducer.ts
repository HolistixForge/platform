import { TEventLoad } from '@holistix-forge/gateway';
import {
  Reducer,
  RequestData,
  TReducersBackendExports,
} from '@holistix-forge/reducers';

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
import { TCollabBackendExports } from '@holistix-forge/collab';

type TRequired = {
  collab: TCollabBackendExports<TTabsSharedData>;
  reducers: TReducersBackendExports;
};

export class TabsReducer extends Reducer<TTabEvents<TabPayload> | TEventLoad> {
  //

  constructor(private readonly depsExports: TRequired) {
    super();
  }

  reduce(
    event: TTabEvents<TabPayload> | TEventLoad,
    requestData: RequestData
  ): Promise<void> {
    //
    switch (event.type) {
      case 'tabs:active-tab-change':
        return this._activeTabChange(event, requestData);
      case 'tabs:add-tab':
        return this._addTab(event, requestData);
      case 'tabs:delete-tab':
        return this._deleteTab(event, requestData);
      case 'tabs:rename-tab':
        return this._renameTab(event, requestData);
      case 'tabs:convert-tab-to-group':
        return this._convertTabToGroup(event, requestData);
      case 'gateway:load':
        return this._load(event, requestData);

      default:
        return Promise.resolve();
    }
  }

  //

  _load(event: TEventLoad, requestData: RequestData) {
    if (!this.depsExports.collab.collab.sharedData['tabs:tabs'].get('unique')) {
      this.depsExports.collab.collab.sharedData['tabs:tabs'].set('unique', {
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
    f: (t: ReadWriteTree<TabPayload>, a: TUsersActiveTabs) => void
  ) {
    const o = this.depsExports.collab.collab.sharedData['tabs:tabs'].get(
      'unique'
    ) as TTabsTree;
    if (o) {
      const no = structuredClone(o);
      const trw = new ReadWriteTree<TabPayload>(no.tree);
      f(trw, no.actives);
      this.depsExports.collab.collab.sharedData['tabs:tabs'].set('unique', {
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

  _activeTabChange(
    event: TEventActiveTabChange,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path } = event;
      this._setActive(actives, path, requestData.user_id);
    });
    return Promise.resolve();
  }

  //

  _addTab(
    event: TEventAddTab<TabPayload>,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path, payload } = event;
      let { title } = event;

      const e = t.get(path, path.length);
      if (e) {
        const l = e.children.length;
        if (!title) title = `New ${l}`;
        t.insert([...path, title], payload || newTabPayload());
        this._setActive(actives, [...path, title], requestData.user_id);
      }
    });
    return Promise.resolve();
  }

  //

  _deleteTab(event: TEventDeleteTab, requestData: RequestData): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path } = event;
      const newSelected = t.delete(path);
      if (newSelected)
        this._setActive(actives, newSelected, requestData.user_id, path);
    });
    return Promise.resolve();
  }

  //

  _renameTab(event: TEventRenameTab, requestData: RequestData): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path, title } = event;
      t.update(path, { title });
      //
      const npath = [...path];
      npath[path.length - 1] = title;
      this._setActive(actives, npath, requestData.user_id, path);
    });
    return Promise.resolve();
  }

  //

  _convertTabToGroup(
    event: TEventConvertTabToGroup,
    requestData: RequestData
  ): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path } = event;
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
            requestData.user_id,
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
