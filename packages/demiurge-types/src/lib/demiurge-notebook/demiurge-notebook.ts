import { TNotebookNode } from './node-types';
import { TSSS_Server } from '../project-server';
import { TJupyterServerData } from '@monorepo/jupyterlab-api';

export type TJupyterServer = TSSS_Server & TJupyterServerData;

export type TPgadminServerData = {
  type: 'pgadmin';
};

export type TPgadminServer = TSSS_Server & TPgadminServerData;

//

export type TServer = TJupyterServer | TPgadminServer;

/**
 *
 */

export type TNodeCommon = {
  id: string;
  busy?: boolean;
};

export type TNodeData = TNodeCommon & TNotebookNode;

export type TProjectMeta = {
  projectActivity: {
    last_activity: string;
    gateway_shutdown: string;
  };
};
