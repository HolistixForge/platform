/* eslint-disable @typescript-eslint/no-explicit-any */
/**
 * Tabs Reducer Tests
 *
 * Focused on project initialization: every project must end up with the
 * "Default Dashboard" and "Resources" tabs.
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

  it('creates the dashboard and resources tabs for a fresh project', async () => {
    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual([
      DEFAULT_DASHBOARD_TAB_TITLE,
      RESOURCES_TAB_TITLE,
    ]);
    expect(types(tabs.tree)).toEqual(['node-editor', 'resources-grid']);
  });

  it('is idempotent - a second init does not duplicate tabs', async () => {
    await reducer.reduce(initEvent, requestData);
    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(tabs.tree.children).toHaveLength(2);
  });

  it('restores the resources tab on a project that predates it', async () => {
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
        ],
      },
      actives: { 'user-1': [DEFAULT_DASHBOARD_TAB_TITLE] },
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual([
      DEFAULT_DASHBOARD_TAB_TITLE,
      RESOURCES_TAB_TITLE,
    ]);
    // existing user state is preserved
    expect(tabs.actives['user-1']).toEqual([DEFAULT_DASHBOARD_TAB_TITLE]);
  });

  it('does not add a second resources tab when one is nested in a group', async () => {
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
            ],
          },
        ],
      },
      actives: {},
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(tabs.tree.children).toHaveLength(1);
    expect(titles(tabs.tree)).toEqual(['Group X']);
  });

  it('keeps user created tabs untouched while restoring resources', async () => {
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
      actives: {},
    });

    await reducer.reduce(initEvent, requestData);

    const tabs = store.get('unique') as TTabsTree;

    expect(titles(tabs.tree)).toEqual(['My Notebook', RESOURCES_TAB_TITLE]);
  });
});
