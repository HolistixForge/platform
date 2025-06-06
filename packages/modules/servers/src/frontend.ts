import './lib/index.scss';
import { Servers_loadData } from './lib/servers-shared-model';
import { NodeServer } from './lib/components/node-server/node-server';
import { NodeVolume } from './lib/components/node-volume/node-volume';
import { ModuleFrontend } from '@monorepo/module/frontend';

export { StatusLed } from './lib/components/status-led';

export { ServerCard, ServerCardInternal } from './lib/components/server-card';

export { awsInstanceTypes } from './lib/components/cloud-instance-options';

export const moduleFrontend: ModuleFrontend = {
  collabChunk: {
    name: 'servers',
    loadSharedData: Servers_loadData,
    deps: ['authentication'],
  },
  spaceMenuEntries: [],
  nodes: {
    server: NodeServer,
    volume: NodeVolume,
  },
};

//
/*
const getToken = async (server: TServer, serviceName: string) => {
  const oauth_client = server.oauth.find(
    (o) => o.service_name === 'jupyterlab'
  );
  if (!oauth_client) throw new Error('jupyterlab not mapped');

  let v;
  do {
    v = ganymedeApi._ts.get({
      client_id: oauth_client.client_id,
    });
    if (v.promise) await v.promise;
  } while (!v.value);

  return v.value.token.access_token;
};
*/
