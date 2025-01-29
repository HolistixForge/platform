import { TSd, toGanymede } from './build-collab';
import {
  TApi_Mount,
  TG_Server,
  TApi_Volume,
  TEc2InstanceState,
  TreeElement,
  TabPayload,
} from '@monorepo/demiurge-types';
import { Dispatcher, TEvent } from '@monorepo/collaborative';
import { PROJECT } from './project-config';
import {
  TNotebookReducersExtraArgs,
  dispatchUpdateAllGraphViews,
  newView,
} from './event-reducers/notebook-reducer';
import { updateProjectMetaActivity } from './event-reducers/meta-reducer';
import {
  addMountEdge,
  addServer,
  addVolume,
} from './event-reducers/project-server-reducer';

//

const DEFAULT_VIEW_1 = 'view-1';
const DEFAULT_VIEW_2 = 'view-2';

const initialTabsTree: TreeElement<TabPayload> = {
  payload: { type: 'group' },
  title: 'root',
  children: [
    {
      title: 'resources grid',
      payload: { type: 'resources-grid' },
      children: [],
    },
    {
      title: 'node-editor-1',
      payload: { type: 'node-editor', viewId: 'view-1' },
      children: [],
    },
    {
      title: 'node-editor-2',
      payload: { type: 'node-editor', viewId: 'view-2' },
      children: [],
    },
  ],
};

//

const headers = () => ({ authorization: PROJECT.GANYMEDE_API_TOKEN });

//
//

export const loadCollaborationData = async (
  sd: TSd,
  dispatcher: Dispatcher<TEvent, TNotebookReducersExtraArgs>,
) => {
  try {
    updateProjectMetaActivity(sd.meta);
    /**
     * set defaults views
     */
    sd.graphViews.set(DEFAULT_VIEW_1, newView());
    sd.graphViews.set(DEFAULT_VIEW_2, newView());

    sd.tabs.set('unique', { tree: initialTabsTree, actives: {} });

    /**
     * add all servers
     */

    const r = await toGanymede<{ _0: TG_Server[] }>({
      url: '/projects/{project_id}/servers',
      method: 'GET',
      headers: headers(),
    });
    const servers = r._0;

    if (servers) {
      for (let i = 0; i < servers.length; i++) {
        const s = servers[i];

        let state: TEc2InstanceState | null = null;

        if (s.location === 'aws') {
          const is = await toGanymede<{ state: TEc2InstanceState }>({
            url: '/projects/{project_id}/server/{project_server_id}/instance-state',
            method: 'GET',
            headers: headers(),
            pathParameters: {
              project_server_id: s.project_server_id,
            },
          });
          state = is.state;
        }

        addServer(sd, s, { x: i * 150, y: 200 + i * 150 }, state);

        /**
         * add incoming edges from volumes nodes
         */

        const rm = await toGanymede<{ _0: TApi_Mount[] }>({
          url: '/projects/{project_id}/server/{project_server_id}/mounts',
          method: 'GET',
          headers: headers(),
          pathParameters: {
            project_server_id: s.project_server_id,
          },
        });

        const mounts = rm._0 as TApi_Mount[];
        if (mounts) {
          mounts.forEach((m) => {
            addMountEdge(sd, m, s.project_server_id);
          });
        }
      }
    }

    /**
     * add all volumes
     */

    const r2 = await toGanymede<{ _0: TApi_Volume[] }>({
      url: '/projects/{project_id}/volume',
      method: 'GET',
      headers: headers(),
    });

    const volumes = r2._0;
    if (volumes) {
      volumes.forEach((v, k) => {
        addVolume(sd, v, { x: k * 150, y: k * 150 });
      });
    }

    /**
     * init graph views from root node
     */
    dispatchUpdateAllGraphViews({ sd, dispatcher }, 'init');
  } catch (err) {
    console.log(err, JSON.stringify(err.toJson?.() || err.message, null, 4));
    throw new Error('STOP');
  }

  return null;
};
