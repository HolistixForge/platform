import { ServerConnection } from '@jupyterlab/services';
import { TJsonArray, TJsonObject } from '@holistix/simple-types';

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

export type TServerSettings = {
  baseUrl: ServerConnection.ISettings['baseUrl'];
  token?: ServerConnection.ISettings['token'];
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
