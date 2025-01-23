import { TNotebookNode } from './node-types';
import { TSSS_Server } from '../project-server';

export type TJupyterServerInfo = TSSS_Server;

export type TPgadminSpecificInfo = {
  type: 'pgadmin';
};

export type TPgadminServerInfo = TSSS_Server & TPgadminSpecificInfo;

//

export type TServer = TJupyterServerInfo | TPgadminServerInfo;

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
