import { ServerConnection } from '@jupyterlab/services';
import { TJsonArray, TJsonObject } from '@holistix-forge/simple-types';

//

export type IOutput = TJsonObject;

export type TKernelType = 'python3';

export type Kernel = {
  kernel_id: string;
  name: string;
  type: TKernelType;
  last_activity?: string;
  execution_state?: string;
  connections?: number;
  notebooks: {
    path: string;
    name: string;
  }[];
};

export type Terminal = {
  terminal_id: string;
  sessionModel: { name: string };
  last_activity?: string;
};

export type Cell = {
  cell_id: string;
  busy: boolean;
  kernel_id: string;
  outputs: TJsonArray;
};

export type TJupyterServerData = {
  user_container_id: string;
  kernels: Record<string, Kernel>;
  terminals: Record<string, Terminal>;
  cells: Record<string, Cell>;
};

export type TUserContainerSettings = {
  baseUrl: ServerConnection.ISettings['baseUrl'];
  token?: ServerConnection.ISettings['token'];
  /**
   * Passed to every request `@jupyterlab/services` makes.
   *
   * The platform's page and a container are different origins, so a request
   * carries no cookie unless it is told to — and the cookie is what the
   * container's auth guard authenticates on. Without this the guard sees an
   * anonymous request, refuses it, and the notebook's kernels and terminals are
   * simply never reachable.
   */
  init?: ServerConnection.ISettings['init'];
};

//

export type TKernelNodeDataPayload = {
  user_container_id: string;
  kernel_id: string;
};

export type TTerminalNodeDataPayload = {
  user_container_id: string;
  terminal_id: string;
};

export type TCellNodeDataPayload = {
  user_container_id: string;
  cell_id: string;
};
