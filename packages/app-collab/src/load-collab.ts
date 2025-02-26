import { TreeElement, TabPayload } from '@monorepo/tabs';
import {
  TApi_Mount,
  TG_Server,
  TApi_Volume,
  makeVolume,
  makeMountEdge,
  TEventNewServer,
} from '@monorepo/servers';
import { Dispatcher } from '@monorepo/collab-engine';
import { TEventNewView } from '@monorepo/space';
import { TEventNewEdge, TEventNewNode } from '@monorepo/core';

import { TSd, toGanymede } from './build-collab';
import { PROJECT } from './project-config';
import { error } from '@monorepo/log';

//

const DEFAULT_VIEW_1 = 'view-1';

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
      payload: { type: 'node-editor', viewId: DEFAULT_VIEW_1 },
      children: [],
    },
  ],
};

//

const headers = () => ({ authorization: PROJECT!.GANYMEDE_API_TOKEN });

//
//

export const loadCollaborationData = async (
  sd: TSd,
  dispatcher: Dispatcher<
    TEventNewView | TEventNewNode | TEventNewEdge | TEventNewServer,
    {}
  >
) => {
  try {
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

        dispatcher.dispatch(
          {
            type: 'servers:new',
            from: {
              project_server_id: s.project_server_id,
            },
          },
          { authorizationHeader: PROJECT!.GANYMEDE_API_TOKEN }
        );

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
            // addMountEdge(sd, m, s.project_server_id);
            const edge = makeMountEdge({
              project_server_id: s.project_server_id,
              mount_point: m.mount_point,
              volume_id: m.volume_id,
            });
            dispatcher.dispatch({
              type: 'core:new-edge',
              edge,
            });
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
        const node = makeVolume(v);
        dispatcher.dispatch({
          type: 'core:new-node',
          nodeData: node,
          edges: [],
        });
      });
    }

    /**
     * create a view
     */

    dispatcher.dispatch({
      type: 'space:new-view',
      viewId: DEFAULT_VIEW_1,
    });
  } catch (err: any) {
    error('LOAD-COLLAB', err);
    console.log(JSON.stringify(err.toJson?.() || err.message, null, 4));
    throw new Error('STOP');
  }

  return null;
};
