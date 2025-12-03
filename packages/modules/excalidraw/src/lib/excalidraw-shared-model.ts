import { TJsonObject } from '@holistix/simple-types';
import { SharedMap } from '@holistix/collab-engine';

export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawSharedData = {
  'excalidraw:drawing': SharedMap<TExcalidrawDrawing>;
};
