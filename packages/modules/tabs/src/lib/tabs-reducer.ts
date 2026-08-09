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
  DEFAULT_DASHBOARD_TAB_TITLE,
  MAX_TAB_ROW,
  RESOURCES_TAB_TITLE,
  TabPath,
  TabPayload,
  TTabsTree,
  TUsersActiveTabs,
} from './tabs-types';
import { TTabsSharedData } from './tabs-shared-model';
import { ReadWriteTree, TreeElement } from './tree';
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
   * Initialize project with default tabs
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

    // Already initialized: the only thing left to do is retire the Resources
    // tab, which is now an entry in the project rail instead. Projects created
    // before that change still carry it, and it used to be *restored* here —
    // so leaving this out would not merely skip the migration, it would put
    // the tab back on the next start.
    if (tabsData && tabsData.tree.children.length > 0) {
      if (!hasTabOfType(tabsData.tree, 'resources-grid')) {
        log(
          EPriority.Info,
          'TABS_INIT',
          `Skipping initialization - tabs already has ${tabsData.tree.children.length} child(ren)`
        );
        return;
      }

      const patched: TTabsTree = {
        tree: withoutResources(tabsData.tree),
        // Anyone whose active tab was the one being removed is moved to the
        // first tab that is left. A stale path leaves the editor with no tab
        // to render and nothing to say why.
        actives: repointActives(tabsData, withoutResources(tabsData.tree)),
      };
      collab.sharedData['tabs:tabs'].set('unique', patched);
      log(
        EPriority.Info,
        'TABS_INIT',
        `✅ Retired the '${RESOURCES_TAB_TITLE}' tab for project ${event.project_id} — it is in the project rail now`
      );
      return;
    }

    // Create default tab structure: dashboard on view-1 + resources grid
    const defaultTab: TTabsTree = {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: DEFAULT_DASHBOARD_TAB_TITLE,
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
      `✅ Created default tab '${DEFAULT_DASHBOARD_TAB_TITLE}' for project ${event.project_id}`
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

/**
 * The tree without the Resources tab, wherever it sits.
 *
 * Walked rather than filtered at the root: a tab can be dragged into a group,
 * and one that was would have survived a shallower removal and come back on
 * every start.
 */
const withoutResources = (
  node: TreeElement<TabPayload>
): TreeElement<TabPayload> => ({
  ...node,
  children: node.children
    .filter((child) => child.payload.type !== 'resources-grid')
    .map(withoutResources),
});

/** The first tab that is not a group — what to fall back to. */
const firstTabPath = (
  node: TreeElement<TabPayload>,
  path: string[] = []
): string[] | undefined => {
  for (const child of node.children) {
    const here = [...path, child.title];
    if (child.payload.type !== 'group') return here;
    const deeper = firstTabPath(child, here);
    if (deeper) return deeper;
  }
  return undefined;
};

/** Every active pointer, with the ones aiming at a removed tab moved. */
const repointActives = (
  before: TTabsTree,
  after: TreeElement<TabPayload>
): TUsersActiveTabs => {
  const fallback = firstTabPath(after);
  const survives = (path: TabPath): boolean => {
    let node: TreeElement<TabPayload> | undefined = after;
    for (const title of path) {
      node = node?.children.find((c) => c.title === title);
      if (!node) return false;
    }
    return true;
  };

  const repointed: TUsersActiveTabs = {};
  for (const [user, path] of Object.entries(before.actives)) {
    if (survives(path)) repointed[user] = path;
    else if (fallback) repointed[user] = fallback;
  }
  return repointed;
};

/**
 * Tabs can be nested inside groups, so the whole tree has to be walked.
 */
const hasTabOfType = (
  node: TreeElement<TabPayload>,
  type: TabPayload['type']
): boolean =>
  node.payload.type === type ||
  node.children.some((child) => hasTabOfType(child, type));
