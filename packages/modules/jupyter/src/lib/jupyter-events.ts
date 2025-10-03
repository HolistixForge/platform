// TODO_DEM: move in plugin/jupyter
import { TEventOrigin } from '@monorepo/core-graph';
import { IOutput, Kernel, Terminal } from './jupyter-types';

export type FormFieldsOnly<T extends TJupyterEvent> = Partial<
  Omit<T, 'viewId' | 'position' | 'type'>
>;

/*
 * events
 */

export type TEventExecutePythonNode = {
  type: 'jupyter:execute-python-node';
  cell_id: string;
  kernel_id: string;
  code: string;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventPythonNodeOutput = {
  type: 'jupyter:python-node-output';
  cell_id: string;
  output: IOutput[];
};

export type TEventClearNodeOutput = {
  type: 'jupyter:clear-node-output';
  cell_id: string;
};

export type TEventNewKernelNode = {
  type: 'jupyter:new-kernel-node';
  project_server_id: number;
  kernel_id: string;
  origin?: TEventOrigin;
};

export type TEventDeleteKernelNode = {
  type: 'jupyter:delete-kernel-node';
  nodeId: string;
};

export type TEventNewCell = {
  type: 'jupyter:new-cell';
  kernel_id: string;
  origin?: TEventOrigin;
};

export type TEventDeleteCell = {
  type: 'jupyter:delete-cell';
  cell_id: string;
};

export type TEventNewTerminal = {
  type: 'jupyter:new-terminal';
  project_server_id: number;
  origin?: TEventOrigin;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventNewTerminalNode = {
  type: 'jupyter:new-terminal-node';
  project_server_id: number;
  origin?: TEventOrigin;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
  terminal_id: string;
};

export type TEventDeleteTerminal = {
  type: 'jupyter:delete-terminal';
  terminal_id: string;
};

export type TEventDeleteTerminalNode = {
  type: 'jupyter:delete-terminal-node';
  nodeId: string;
};

export type TEventJupyterResourcesChanged = {
  type: 'jupyter:resources-changed';
  project_server_id: number;
  resources: {
    kernels: Kernel[];
    terminals: Terminal[];
  };
};

export type TJupyterEvent =
  | TEventExecutePythonNode
  | TEventPythonNodeOutput
  | TEventClearNodeOutput
  // kernel
  | TEventNewKernelNode
  | TEventDeleteKernelNode
  | TEventNewCell
  | TEventDeleteCell
  // terminal
  | TEventNewTerminal
  | TEventNewTerminalNode
  | TEventDeleteTerminal
  | TEventDeleteTerminalNode
  | TEventJupyterResourcesChanged;
