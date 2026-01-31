import { RequestData, TReducersBackendExports } from '@holistix-forge/reducers';
import { ReducerWithCollab } from '@holistix-forge/collab';
import { log, EPriority } from '@holistix-forge/log';

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
import { TEventProjectInit } from '@holistix-forge/gateway';

type TRequired = {
  collab: TCollabBackendExports;
  reducers: TReducersBackendExports;
};

type TTabsEvents = TTabEvents<TabPayload> | TEventProjectInit;

// Note: Project initialization (default tabs, views) is now handled by
// the project:init event dispatched when a user first opens a project.
// This ensures data is written to the correct project-specific YJS doc.

export class TabsReducer extends ReducerWithCollab<
  TTabsEvents,
  TTabsSharedData
> {
  //

  constructor(depsExports: TRequired) {
    super(depsExports.collab.registry, 'tabs');
    this.depsExports = depsExports;
  }

  // Used by base class and event processing
  // @ts-expect-error - TypeScript doesn't recognize usage in base class
  private depsExports: TRequired;

  reduce(event: TTabsEvents, requestData: RequestData): Promise<void> {
    //
    switch (event.type) {
      case 'project:init':
        return this._initProject(event, requestData);

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

      default:
        return Promise.resolve();
    }
  }

  //

  __deepCopyEditAndApply(
    f: (t: ReadWriteTree<TabPayload>, a: TUsersActiveTabs) => void,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const o = collab.sharedData['tabs:tabs'].get('unique') as TTabsTree;
    if (o) {
      const no = structuredClone(o);
      const trw = new ReadWriteTree<TabPayload>(no.tree);
      f(trw, no.actives);
      collab.sharedData['tabs:tabs'].set('unique', {
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
    }, requestData);
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
    }, requestData);
    return Promise.resolve();
  }

  //

  _deleteTab(event: TEventDeleteTab, requestData: RequestData): Promise<void> {
    this.__deepCopyEditAndApply((t, actives) => {
      const { path } = event;
      const newSelected = t.delete(path);
      if (newSelected)
        this._setActive(actives, newSelected, requestData.user_id, path);
    }, requestData);
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
    }, requestData);
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
    }, requestData);
    return Promise.resolve();
  }

  /**
   * Initialize project with default tab
   * Called when a new project is created
   */
  private async _initProject(
    event: TEventProjectInit,
    requestData: RequestData
  ): Promise<void> {
    const collab = this.getCollab(requestData);
    const tabsData = collab.sharedData['tabs:tabs'].get('unique');

    const childrenCount = tabsData?.tree.children.length ?? 0;
    log(
      EPriority.Info,
      'TABS_INIT',
      `project:init called for project ${event.project_id}, current tabs children: ${childrenCount}`
    );

    // Check if already initialized (idempotent)
    if (tabsData && tabsData.tree.children.length > 0) {
      log(
        EPriority.Info,
        'TABS_INIT',
        `Skipping initialization - tabs already has ${tabsData.tree.children.length} child(ren)`
      );
      return;
    }

    // Create default tab structure with "Default Dashboard" pointing to view-1
    const defaultTab: TTabsTree = {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: 'Default Dashboard',
            payload: {
              type: 'node-editor',
              viewId: 'view-1', // References whiteboard view-1
            },
            children: [],
          },
        ],
      },
      actives: {},
    };

    collab.sharedData['tabs:tabs'].set('unique', defaultTab);
    log(
      EPriority.Info,
      'TABS_INIT',
      `✅ Created default tab 'Default Dashboard' for project ${event.project_id}`
    );
  }
}

//
//

const newTabPayload = (): TabPayload => ({
  type: 'node-editor',
  viewId: 'todo',
});

const newGroup = (): TabPayload => ({ type: 'group' });
