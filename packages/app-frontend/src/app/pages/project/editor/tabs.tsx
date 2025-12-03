import { FC } from 'react';

import {
  PanelProps,
  TabsRadix,
  MAX_TAB_ROW,
  ReadOnlyTree,
  TabPath,
  TabPayload,
  TTabsSharedData,
  TTabsTree,
} from '@holistix/tabs';
import { useCurrentUser } from '@holistix/frontend-data';
import { useLocalSharedData } from '@holistix/collab/frontend';
import { serviceUrl } from '@holistix/user-containers';

import { useDispatcher } from '../model/collab-model-chunk';
import { TServer, TServersSharedData } from '@holistix/user-containers';
import { NodeEditorView } from './node-editor/node-editor-view';
import { ResourcePage } from './resources-page';

//

export const EditorTabsSystemLogic = () => {
  //
  const sdTabs: TTabsTree = useLocalSharedData<TTabsSharedData>(
    ['tabs:tabs'],
    (d) => d['tabs:tabs'].get('unique')
  );

  const dispatcher = useDispatcher();

  const { data, status } = useCurrentUser();

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
    if (path[0] !== 'node-editor-1' && path[0] !== 'resources-grid')
      dispatcher.dispatch({ type: 'tabs:delete-tab', path });
  };

  const onTabRowAdd = (path: string[]) => {
    dispatcher.dispatch({ type: 'tabs:convert-tab-to-group', path });
  };

  const onTabRename = (path: string[], newName: string) => {
    // dispatcher.dispatch({ type: 'tabs:rename-tab', path, title: newName });
  };

  //

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
    payload: { type: 'group' },
    title: 'root',
    children: [],
  };

  if (tree) {
    const roTree = new ReadOnlyTree(tree);
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
            <TabTypeRouter
              key={tab.path.join('.')}
              tabPath={tab.path}
              {...tab}
            />
          ))}
        </TabsRadix>
      </div>
    );
  }

  return null;
};

//

const TabTypeRouter: FC<PanelProps & TabPayload> = (props) => {
  if (props.type === 'node-editor') {
    return <NodeEditorView viewId={props.viewId} />;
  } else if (props.type === 'resources-grid') {
    return <ResourcePage />;
  } else if (props.type === 'resource-ui') {
    return (
      <ProjectServerUIView
        project_server_id={props.project_server_id}
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

const ProjectServerUIView = (props: {
  project_server_id: number;
  service_name: string;
}) => {
  const server: TServer = useSharedData<TServersSharedData>(
    ['user-containers:containers'],
    (sd) => sd['user-containers:containers'].get(`${props.project_server_id}`)
  );

  const url = serviceUrl(server, props.service_name);

  if (url)
    return (
      <iframe style={{ width: '100%', height: '100%' }} src={url}></iframe>
    );
  return null;
};
