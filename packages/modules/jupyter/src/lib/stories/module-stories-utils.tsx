import { useCallback, useEffect, useState } from 'react';

import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { TUserContainersSharedData } from '@holistix-forge/user-containers';
import { TCoreSharedData } from '@holistix-forge/core-graph';
import type { TModule } from '@holistix-forge/module';
import type { TCollabBackendExports } from '@holistix-forge/collab';

//

import { TJupyterSharedData } from '../../lib/jupyter-shared-model';

//

const STORY_TOKEN = 'My_Super_Test_Story';

const STORY_JUPYTERLAB_CLIENT_ID = 'jupyterlab-story';

export const STORY_PROJECT_ID = 0;

export const STORY_USER_CONTAINER_ID = '0';

const STORY_JUPYTER_PORT = 36666;
const STORY_JUPYTER_IP = '127.0.0.1';

//

export const createStoryInitModule = (): TModule<
  {
    collab: TCollabBackendExports<
      TUserContainersSharedData & TJupyterSharedData & TCoreSharedData
    >;
  },
  object
> => {
  return {
    name: 'story-init',
    version: '0.0.1',
    description: 'Story init module for Jupyter',
    dependencies: ['collab', 'user-containers', 'jupyter'],
    load: ({ depsExports }) => {
      // Mock a user container with Jupyter service
      const containersMap =
        depsExports.collab.collab.sharedData['user-containers:containers'];

      // Create mock container
      containersMap.set(STORY_USER_CONTAINER_ID, {
        user_container_id: STORY_USER_CONTAINER_ID,
        container_name: 'story-jupyter-server',
        image_id: 'jupyter:minimal',
        httpServices: [],
        ip: STORY_JUPYTER_IP,
        last_watchdog_at: new Date().toISOString(),
        last_activity: new Date().toISOString(),
        created_at: new Date().toISOString(),
        runner: { id: 'local' },
        oauth: [
          {
            service_name: 'jupyterlab',
            client_id: STORY_JUPYTERLAB_CLIENT_ID,
          },
        ],
      });
    },
  };
};

//

export const JupyterStoryInit = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const { isLoading, error } = useInitStoryJupyterServer();

  console.log('JupyterStoryInit', { isLoading, error });

  if (isLoading || error) {
    return (
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
          $ docker run --rm -p {STORY_JUPYTER_PORT}:8888
          jupyter/minimal-notebook:latest start-notebook.sh
          --NotebookApp.allow_origin='*' --NotebookApp.token='{STORY_TOKEN}'
          --debug
        </p>
        {error && <div style={{ color: 'red' }}>Error: {error.message}</div>}
      </div>
    );
  }

  return children;
};

//

interface UseInitStoryJupyterServerResult {
  isLoading: boolean;
  error: Error | null;
}

export const useInitStoryJupyterServer =
  (): UseInitStoryJupyterServerResult => {
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState<Error | null>(null);
    const sd = useLocalSharedData<
      TUserContainersSharedData & TJupyterSharedData & TCoreSharedData
    >(['user-containers:containers', 'jupyter:servers'], (sd) => sd);

    const server = sd['user-containers:containers'].get(
      STORY_USER_CONTAINER_ID.toString()
    );
    const jupyter = sd['jupyter:servers'].get(
      STORY_USER_CONTAINER_ID.toString()
    );
    const service = server?.httpServices.find(
      (s: { name: string }) => s.name === 'jupyterlab'
    );

    const [running, setRunning] = useState<boolean | null>(null);

    useEffect(() => {
      fetch(`http://${STORY_JUPYTER_IP}:${STORY_JUPYTER_PORT}/api`)
        .then((r) => {
          if (r.status === 200) {
            console.log('Jupyter server is running');
            setRunning(true);
          } else {
            setRunning(false);
          }
        })
        .catch(() => {
          setRunning(false);
        });
    }, []);

    const initializeServer = useCallback(async () => {
      console.log('initializeServer', { server, jupyter, service });
      try {
        if (running === null) {
          return;
        } else if (running === false) {
          setError(new Error('Jupyter server is not running'));
          setIsLoading(false);
          return;
        }

        // Check if we have both jupyter entry and service mapped
        if (!jupyter || !service) {
          // Manually set up the HTTP service in the shared data
          // In a real environment, this would be done via the user-container:map-http-service event
          // But for the story, we directly manipulate the shared data
          if (server) {
            const httpServices = [...server.httpServices];
            if (!httpServices.find((s) => s.name === 'jupyterlab')) {
              httpServices.push({
                name: 'jupyterlab',
                host: STORY_JUPYTER_IP,
                port: STORY_JUPYTER_PORT,
                secure: false,
              });

              // Update the server with the new service
              sd['user-containers:containers'].set(STORY_USER_CONTAINER_ID, {
                ...server,
                httpServices,
              });
            }
          }

          // Initialize Jupyter server data if not exists
          if (!jupyter) {
            sd['jupyter:servers'].set(STORY_USER_CONTAINER_ID, {
              user_container_id: STORY_USER_CONTAINER_ID,
              kernels: {},
              cells: {},
              terminals: {},
            });
          }

          // Return to re-check on next render
          return;
        }

        // Only set loading to false if we have both jupyter entry and service
        if (jupyter && service) {
          console.log('Jupyter server is initialized');
          isLoading && setIsLoading(false);
        }
      } catch (err) {
        setError(
          err instanceof Error ? err : new Error('Failed to initialize server')
        );
        isLoading && setIsLoading(false);
      }
    }, [server, jupyter, service, running, isLoading, sd]);

    useEffect(() => {
      initializeServer();
    }, [initializeServer]);

    return {
      isLoading,
      error,
    };
  };
