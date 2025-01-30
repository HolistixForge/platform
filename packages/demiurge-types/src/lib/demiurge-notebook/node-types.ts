// TODO_DEM: delete

import { IOutput } from '@monorepo/jupyterlab-api';

export type TNodeGeneric<name extends TNodeType, TPayload> = {
  type: name;
} & TPayload;

//

export type TNodePython = {
  code: string;
  output?: IOutput[];
  dkid: string;
};

export type TNodeMarkDown = {
  code: string;
};

export type TNodeVideo = {
  youtubeId: string;
};

export type TNodeTerminal = {
  server_name: string;
  project_server_id: number;
};

export type TNodeServer = {
  server_name: string;
  project_server_id: number;
};

export type TNodeKernel = {
  project_server_id: number;
  dkid: string;
};

export type TNodeVolume = {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
};

export type TNodeChat = {
  chatId: string;
};

//

export type TNodeType =
  | 'python'
  | 'markdown'
  | 'video'
  | 'terminal'
  | 'server'
  | 'kernel'
  | 'volume'
  | 'chat'
  | 'chat-anchor'
  | 'default';

export type TNotebookNode =
  | TNodeGeneric<'python', TNodePython>
  | TNodeGeneric<'markdown', TNodeMarkDown>
  | TNodeGeneric<'video', TNodeVideo>
  | TNodeGeneric<'terminal', TNodeTerminal>
  | TNodeGeneric<'server', TNodeServer>
  | TNodeGeneric<'kernel', TNodeKernel>
  | TNodeGeneric<'volume', TNodeVolume>
  | TNodeGeneric<'chat', TNodeChat>
  | TNodeGeneric<'chat-anchor', TNodeChat>;
