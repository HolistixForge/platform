/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tabs Reducer Tests
 *
 * Focused on project initialization: every project ends up with the
 * "Default Dashboard" tab, and with no "Resources" tab.
 *
 * Resources is a place in the project rail now, not a board. It used to be
 * created here for every project and put back whenever it went missing, which
 * is why removing it takes a migration rather than a deletion: without one,
 * the old tab comes back on the next start of every project that has it.
 */

import { TabsReducer } from './tabs-reducer';
import {
  DEFAULT_DASHBOARD_TAB_TITLE,
  RESOURCES_TAB_TITLE,
  TabPayload,
  TTabsTree,
} from './tabs-types';
import { TreeElement } from './tree';

jest.mock('@holistix-forge/log', () => ({
  EPriority: {
    Info: 'info',
    Warning: 'warning',
    Error: 'error',
    Debug: 'debug',
  },
  log: jest.fn(),
  error: jest.fn(),
}));

const PROJECT_ID = 'test-project-123';

const initEvent = {
  type: 'project:init' as const,
  project_id: PROJECT_ID,
  systemEvent: true as const,
};

const requestData = { project_id: PROJECT_ID, user_id: 'system' } as any;

const titles = (tree: TreeElement<TabPayload>) =>
  tree.children.map((c) => c.title);

const types = (tree: TreeElement<TabPayload>) =>
  tree.children.map((c) => c.payload.type);

describe('TabsReducer - project:init', () => {
  let reducer: TabsReducer;
  let store: Map<string, TTabsTree>;

  beforeEach(() => {
    store = new Map();

    const tabsSharedMap = {
      get: (key: string) => store.get(key),
      set: (key: string, value: TTabsTree) => store.set(key, value),
      copy: () => new Map(store),
    };

    const depsExports = {
      collab: {
        registry: {
          getCollabForProject: jest.fn(() => ({
            sharedData: { 'tabs:tabs': tabsSharedMap },
          })),
          registerSharedData: jest.fn(),
        },
      },
      reducers: {},
    };

    reducer = new TabsReducer(depsExports as any);
  });

  it('creates only the dashboard tab for a fresh project', async () => {
    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual([DEFAULT_DASHBOARD_TAB_TITLE]);
    expect(types(tabs.tree)).toEqual(['node-editor']);
  });

  it('is idempotent - a second init does not duplicate tabs', async () => {
    await reducer.reduce(initEvent, requestData);
    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(tabs.tree.children).toHaveLength(1);
  });

  it('retires the resources tab on a project that still has one', async () => {
    store.set('unique', {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: DEFAULT_DASHBOARD_TAB_TITLE,
            payload: { type: 'node-editor', viewId: 'view-1' },
            children: [],
          },
          {
            title: RESOURCES_TAB_TITLE,
            payload: { type: 'resources-grid' },
            children: [],
          },
        ],
      },
      actives: { 'user-1': [DEFAULT_DASHBOARD_TAB_TITLE] },
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual([DEFAULT_DASHBOARD_TAB_TITLE]);
    // Someone who was not looking at it is left where they were.
    expect(tabs.actives['user-1']).toEqual([DEFAULT_DASHBOARD_TAB_TITLE]);
  });

  it('moves anyone who was looking at it to the tab that is left', async () => {
    // A stale active path leaves the editor with no tab to render and nothing
    // to say why — a blank page on the next visit, for that user only.
    store.set('unique', {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: DEFAULT_DASHBOARD_TAB_TITLE,
            payload: { type: 'node-editor', viewId: 'view-1' },
            children: [],
          },
          {
            title: RESOURCES_TAB_TITLE,
            payload: { type: 'resources-grid' },
            children: [],
          },
        ],
      },
      actives: { 'user-1': [RESOURCES_TAB_TITLE] },
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(tabs.actives['user-1']).toEqual([DEFAULT_DASHBOARD_TAB_TITLE]);
  });

  it('finds it inside a group, where a drag could have put it', async () => {
    // Filtered at the root only, a tab someone had dragged into a group would
    // survive the migration and be restored-then-removed forever.
    store.set('unique', {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: 'Group X',
            payload: { type: 'group' },
            children: [
              {
                title: RESOURCES_TAB_TITLE,
                payload: { type: 'resources-grid' },
                children: [],
              },
              {
                title: 'Mine',
                payload: { type: 'node-editor', viewId: 'view-2' },
                children: [],
              },
            ],
          },
        ],
      },
      actives: {},
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual(['Group X']);
    expect(tabs.tree.children[0].children.map((c) => c.title)).toEqual([
      'Mine',
    ]);
  });

  it('leaves a project that never had one alone', async () => {
    store.set('unique', {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: 'My Notebook',
            payload: {
              type: 'resource-ui',
              user_container_id: 1,
              service_name: 'jupyter',
            },
            children: [],
          },
        ],
      },
      actives: { 'user-1': ['My Notebook'] },
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual(['My Notebook']);
    expect(tabs.actives['user-1']).toEqual(['My Notebook']);
  });

  it('keeps the tabs a user made while retiring the one it owns', async () => {
    store.set('unique', {
      tree: {
        title: 'Root',
        payload: { type: 'group' },
        children: [
          {
            title: 'My Notebook',
            payload: {
              type: 'resource-ui',
              user_container_id: 1,
              service_name: 'jupyter',
            },
            children: [],
          },
          {
            title: RESOURCES_TAB_TITLE,
            payload: { type: 'resources-grid' },
            children: [],
          },
        ],
      },
      actives: {},
    });

    await reducer.reduce(initEvent, requestData);

    expect(titles((store.get('unique') as TTabsTree).tree)).toEqual([
      'My Notebook',
    ]);
  });
});
