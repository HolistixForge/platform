import { TJsonObject } from '@monorepo/simple-types';
import { SharedMap } from '@monorepo/collab-engine';

export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawSharedData = {
  'excalidraw:drawing': SharedMap<TExcalidrawDrawing>;
};
