import { TCollaborativeChunk } from '@monorepo/collab-engine';
import { TJsonObject } from '@monorepo/simple-types';

//

export type ModuleBackend = {
  collabChunk: TCollaborativeChunk;
};

export type TPin = {
  id: string;
  pinName: string;
  disabled?: boolean;
  type?: 'in' | 'out' | 'inout';
};

export type TConnector = {
  connectorName: string;
  disabled?: boolean;
  pins: TPin[];
};

export type TGraphNode<TData = TJsonObject> = {
  id: string;
  name: string;
  type: string;
  root: boolean;
  data?: TData;
  connectors: TConnector[];
};
