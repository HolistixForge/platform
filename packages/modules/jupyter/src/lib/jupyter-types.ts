import { ServerConnection } from '@jupyterlab/services';
import { TJsonArray, TJsonObject } from '@monorepo/simple-types';

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
  project_server_id: number;
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
  project_server_id: number;
  kernel_id: string;
};

export type TTerminalNodeDataPayload = {
  project_server_id: number;
  terminal_id: string;
};

export type TCellNodeDataPayload = {
  project_server_id: number;
  cell_id: string;
};
