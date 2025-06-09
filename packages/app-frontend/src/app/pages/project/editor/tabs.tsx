import { FC } from 'react';

import {
  PanelProps,
  TabsRadix,
  MAX_TAB_ROW,
  ReadOnlyTree,
  TabPath,
  TabPayload,
} from '@monorepo/tabs';
import { useCurrentUser } from '@monorepo/frontend-data';
import { serviceUrl } from '@monorepo/servers';

import { NodeEditorView } from './node-editor/node-editor-view';
import { ResourcePage } from './resources-page';
import { useDispatcher, useSharedData } from '../model/collab-model-chunk';

//

export const EditorTabsSystemLogic = () => {
  //
  const sdTabs = useSharedData(['tabs'], (d) => d.tabs.get('unique'));

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
    dispatcher.dispatch({ type: 'tabs:delete-tab', path });
  };

  const onTabRowAdd = (path: string[]) => {
    dispatcher.dispatch({ type: 'tabs:convert-tab-to-group', path });
  };

  const onTabRename = (path: string[], newName: string) => {
    dispatcher.dispatch({ type: 'tabs:rename-tab', path, title: newName });
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
          {roTree.flat().map((panel) => (
            <Panel key={panel.path.join('.')} tabPath={panel.path} {...panel} />
          ))}
        </TabsRadix>
      </div>
    );
  }

  return null;
};

//

const Panel: FC<PanelProps & TabPayload> = (props) => {
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
  const server = useSharedData(['projectServers'], (sd) =>
    sd.projectServers.get(`${props.project_server_id}`)
  );

  const url = serviceUrl(server, props.service_name);

  if (url)
    return (
      <iframe style={{ width: '100%', height: '100%' }} src={url}></iframe>
    );
  return null;
};
