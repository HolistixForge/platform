// TODO_DEM: move in plugin/jupyter
import { TEventOrigin } from '@monorepo/core';
import { TDKID, TJKID, IOutput } from './jupyter-types';

export type FormFieldsOnly<T extends TDemiurgeNotebookEvent> = Partial<
  Omit<T, 'viewId' | 'position' | 'type'>
>;

/*
 * events
 */

export type TEventExecutePythonNode = {
  type: 'jupyter:execute-python-node';
  cellId: string;
  dkid: TDKID;
  code: string;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventPythonNodeOutput = {
  type: 'jupyter:python-node-output';
  cellId: string;
  output: IOutput[];
};

export type TEventClearNodeOutput = {
  type: 'jupyter:clear-node-output';
  cellId: string;
};

export type TEventKernelStarted = {
  type: 'jupyter:_kernel-started_';
  dkid: TDKID;
  jkid: TJKID;
};

export type TEventStartKernel = {
  type: 'jupyter:start-kernel';
  dkid: TDKID;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventStopKernel = {
  type: 'jupyter:stop-kernel';
  dkid: TDKID;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventNewKernel = {
  type: 'jupyter:new-kernel';
  project_server_id: number;
  kernelName: string;
  origin?: TEventOrigin;
};

export type TEventDeleteKernel = {
  type: 'jupyter:delete-kernel';
  dkid: TDKID;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventNewCell = {
  type: 'jupyter:new-cell';
  dkid: TDKID;
  origin?: TEventOrigin;
};

export type TEventDeleteCell = {
  type: 'jupyter:delete-cell';
  cellId: string;
};

export type TEventNewTerminal = {
  type: 'jupyter:new-terminal';
  project_server_id: number;
  origin?: TEventOrigin;
  /** not use directly but force to pass specific jwt token (see GanymedeApi._getTokenKeyForRequest) */
  client_id: string;
};

export type TEventDeleteTerminal = {
  type: 'jupyter:delete-terminal';
  terminalId: string;
};

export type TDemiurgeNotebookEvent =
  | TEventExecutePythonNode
  | TEventPythonNodeOutput
  | TEventStartKernel
  | TEventKernelStarted
  | TEventClearNodeOutput
  | TEventNewKernel
  | TEventStopKernel
  | TEventDeleteKernel
  | TEventNewCell
  | TEventDeleteCell
  | TEventNewTerminal
  | TEventDeleteTerminal;
