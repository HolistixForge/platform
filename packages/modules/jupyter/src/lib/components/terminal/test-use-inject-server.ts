import { useEffect } from 'react';

import {
  useDispatcher,
  useSharedData,
  SharedMap,
} from '@monorepo/collab-engine';
import { TServer, TServersSharedData } from '@monorepo/servers';

//

export const useInjectServer = () => {
  const dispatcher = useDispatcher<any>();
  const servers: SharedMap<TServer> = useSharedData<TServersSharedData>(
    ['projectServers'],
    (sd) => sd.projectServers
  );

  useEffect(() => {
    // Direct brutal injection of server data !
    dispatcher._sharedTypes.transaction(async () => {
      servers.set(`0`, {
        project_server_id: 0,
        project_id: 0,
        server_name: `server 0`,
        image_id: 0,
        host_user_id: null,
        oauth: [],
        location: 'none',
        httpServices: [
          {
            name: 'jupyterlab',
            host: '127.0.0.1',
            port: 36666,
            location: '',
            secure: false,
          },
        ],
        last_watchdog_at: null,
        last_activity: null,
        ec2_instance_state: null,
        type: '',
      });
    });
  }, []); // Empty deps array means run once on mount

  return { servers };
};
