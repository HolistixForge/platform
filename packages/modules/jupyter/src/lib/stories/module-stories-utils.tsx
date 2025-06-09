import { MockCollaborativeContext } from '@monorepo/collab-engine';

import { moduleBackend as coreBackend } from '@monorepo/core';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleBackend as serversBackend } from '@monorepo/servers';
import { moduleBackend as jupyterBackend } from '@monorepo/jupyter';

import { moduleFrontend as coreFrontend } from '@monorepo/core';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { moduleFrontend as serversFrontend } from '@monorepo/servers/frontend';
import { moduleFrontend as jupyterFrontend } from '@monorepo/jupyter/frontend';

//

export const STORY_PROJECT_ID = 0;

export const STORY_PROJECT_SERVER_ID = 0;

//

const modulesBackend = [
  coreBackend,
  spaceBackend,
  serversBackend,
  jupyterBackend,
];

const modulesFrontend = [
  coreFrontend,
  spaceFrontend,
  serversFrontend,
  jupyterFrontend,
];

//

export const JupyterStoryCollabContext = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  return (
    <MockCollaborativeContext
      frontChunks={modulesFrontend.map((m) => m.collabChunk)}
      backChunks={modulesBackend.map((m) => m.collabChunk)}
    >
      <div style={{ width: '80vw', height: '800px' }}>
        <p>
          To test this story, first launch a jupyter docker container, then
          refresh :
        </p>
        <p
          style={{
            fontFamily: 'monospace',
            backgroundColor: '#2b2b2b',
            color: '#e6e6e6',
            padding: '8px',
            borderRadius: '4px',
            margin: '20px 0',
          }}
        >
          $ docker run --rm -p 36666:8888 jupyter/minimal-notebook:latest
          start-notebook.sh --NotebookApp.allow_origin='*'
          --NotebookApp.token='My_Super_Test_Story' --debug
        </p>
        {children}
      </div>
    </MockCollaborativeContext>
  );
};

// sd.graphViews.set('story-view', defaultGraphView());

/*
let mock_servers: TG_Server[] = [];
return {
  // a mock toGanymede that returns a new server id to allow servers:new-server to work
  toGanymede: async (req: TMyfetchRequest) => {
    console.log({ req });
    if (
      req.method === 'POST' &&
      req.url === `/projects/{project_id}/servers`
    ) {
      const psid = mock_servers.length;
      mock_servers.push({
        project_server_id: psid,
        server_name: (req.jsonBody as any)?.name || 'story-server',
        image_id: (req.jsonBody as any)?.imageId || 2,
        project_id: STORY_PROJECT_ID,
        host_user_id: null,
        oauth: [],
        location: 'none',
      });
      return {
        _0: {
          new_project_server_id: psid,
        },
      };
    }

    if (
      req.method === 'GET' &&
      req.url === `/projects/{project_id}/servers`
    ) {
      return {
        _0: mock_servers,
      };
    }

    throw new Error('Not implemented');
  },

  // mock jwt payload
  jwt: {
    project_server_id: STORY_PROJECT_SERVER_ID,
  },

  // mock gatewayFQDN so that it ends to our test jupyter docker container
  gatewayFQDN: '127.0.0.1',
};
*/

/*
return {
  ...Jupyter_Load_Frontend_ExtraContext(args),
  // mock user jupyterlab token for JupyterReducer that run in backend in normal mode
  authorizationHeader: 'My_Super_Test_Story',
};
*/
