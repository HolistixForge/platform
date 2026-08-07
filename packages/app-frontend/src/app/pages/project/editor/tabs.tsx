import { FC } from 'react';

import {
  DEFAULT_DASHBOARD_TAB_TITLE,
  MAX_TAB_ROW,
  ReadOnlyTree,
  RESOURCES_TAB_TITLE,
  TabPath,
  TabPayload,
  TTabsSharedData,
  TTabsTree,
} from '@holistix-forge/tabs';
import { PanelProps, TabsRadix } from '@holistix-forge/tabs/frontend';
import { useCurrentUser } from '@holistix-forge/frontend-data';
import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { serviceUrl } from '@holistix-forge/user-containers';

import { useDispatcher } from '../model/collab-model-chunk';
import {
  TUserContainer,
  TUserContainersSharedData,
} from '@holistix-forge/user-containers';
import { NodeEditorView } from './node-editor/node-editor-view';
import { ResourcePage } from './resources-page';

//

/**
 * Which tab is open, and what it holds.
 *
 * A hook rather than a value computed in the tab system, because the page
 * around the tabs needs the answer too — the project rail is a bar beside the
 * content on most tabs and an island over it on the whiteboard. Two copies of
 * "which tab is active" is the kind of thing that agrees until one of them is
 * changed.
 */
export const useActiveTab = () => {
  const sdTabs: TTabsTree = useLocalSharedData<TTabsSharedData>(
    ['tabs:tabs'],
    (d) => d['tabs:tabs'].get('unique')
  );
  const { data, status } = useCurrentUser();

  let active: TabPath = [];
  if (sdTabs) {
    if (
      status === 'success' &&
      data.user.user_id &&
      sdTabs.actives[data.user.user_id]
    )
      active = sdTabs.actives[data.user.user_id];
    else
      active = sdTabs.tree.children[0] ? [sdTabs.tree.children[0].title] : [];
  }

  const tree = sdTabs?.tree || {
    payload: { type: 'group' as const },
    title: 'root',
    children: [],
  };

  const roTree = new ReadOnlyTree(tree);
  const payload = roTree.get(active, active.length)?.payload as
    | TabPayload
    | undefined;

  return { roTree, active, payload };
};

export const EditorTabsSystemLogic = () => {
  //
  const { roTree, active } = useActiveTab();

  const dispatcher = useDispatcher();

  //

  const onTabAdd = (
    path: string[],
    title = 'New Tab',
    payload: TabPayload = { type: 'none' }
  ) => {
    dispatcher.dispatch({ type: 'tabs:add-tab', path, title, payload });
  };

  const onTabChange = (path: string[]) => {
    dispatcher.dispatch({ type: 'tabs:active-tab-change', path });
  };

  const onTabDelete = (path: string[]) => {
    // TODO: confirm before deleting
    // The default tabs are recreated on project:init, so deleting them
    // would only make them come back on the next reload.
    const isDefaultTab =
      path.length === 1 &&
      (path[0] === DEFAULT_DASHBOARD_TAB_TITLE ||
        path[0] === RESOURCES_TAB_TITLE);

    if (!isDefaultTab) dispatcher.dispatch({ type: 'tabs:delete-tab', path });
  };

  const onTabRowAdd = (path: string[]) => {
    dispatcher.dispatch({ type: 'tabs:convert-tab-to-group', path });
  };

  const onTabRename = (path: string[], newName: string) => {
    // dispatcher.dispatch({ type: 'tabs:rename-tab', path, title: newName });
  };

  //

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <TabsRadix
        tree={roTree}
        maxRow={MAX_TAB_ROW}
        active={active}
        onTabChange={onTabChange}
        onTabAdd={onTabAdd}
        onTabDelete={onTabDelete}
        onTabRowAdd={onTabRowAdd}
        onTabRename={onTabRename}
      >
        {roTree.flat().map((tab) => (
          <TabTypeRouter key={tab.path.join('.')} tabPath={tab.path} {...tab} />
        ))}
      </TabsRadix>
    </div>
  );
};

//

const TabTypeRouter: FC<PanelProps & TabPayload> = (props) => {
  if (props.type === 'node-editor') {
    return <NodeEditorView viewId={props.viewId} />;
  } else if (props.type === 'resources-grid') {
    return <ResourcePage />;
  } else if (props.type === 'resource-ui') {
    return (
      <ProjecTUserContainerUIView
        project_server_id={props.user_container_id}
        service_name={props.service_name}
      />
    );
  } else if (props.type === 'group') {
    return <div></div>;
  }
  //
  else return <span>Unknown Tab Content {props.type}</span>;
};

//

const ProjecTUserContainerUIView = (props: {
  project_server_id: number;
  service_name: string;
}) => {
  const server: TUserContainer = useLocalSharedData<TUserContainersSharedData>(
    ['user-containers:containers'],
    (sd) => sd['user-containers:containers'].get(`${props.project_server_id}`)
  );

  const url = serviceUrl(server, props.service_name);

  if (url)
    return (
      <iframe
        title={props.service_name}
        style={{ width: '100%', height: '100%' }}
        src={url}
      ></iframe>
    );
  return null;
};
