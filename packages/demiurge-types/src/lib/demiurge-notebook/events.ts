import { TEventOrigin } from '../demiurge-space/events';
import { TDKID, TJKID } from './demiurge-notebook';
import { IOutput } from './node-types';

export type FormFieldsOnly<T extends TDemiurgeNotebookEvent> = Partial<
  Omit<T, keyof TEventOrigin | 'type'>
>;

/*
 * events
 */

export type TEventExecutePythonNode = {
  type: 'execute-python-node';
  nid: string;
  dkid: TDKID;
  code: string;
};

export type TEventPythonNodeOutput = {
  type: 'python-node-output';
  nid: string;
  output: IOutput[];
};

export type TEventClearNodeOutput = {
  type: 'clear-node-output';
  nid: string;
};

export type TEventKernelStarted = {
  type: 'kernel-started';
  dkid: TDKID;
  jkid: TJKID;
};

export type TEventStartKernel = {
  type: 'start-kernel';
  dkid: TDKID;
};

export type TEventStopKernel = {
  type: 'stop-kernel';
  dkid: TDKID;
};

export type TEventNewKernel = {
  type: 'new-kernel';
  project_server_id: number;
  kernelName: string;
} & TEventOrigin;

export type TEventDeleteKernel = {
  type: 'delete-kernel';
  dkid: TDKID;
};

export type TDemiurgeNotebookEvent =
  | TEventExecutePythonNode
  | TEventPythonNodeOutput
  | TEventStartKernel
  | TEventKernelStarted
  | TEventClearNodeOutput
  | TEventNewKernel
  | TEventStopKernel
  | TEventDeleteKernel;
