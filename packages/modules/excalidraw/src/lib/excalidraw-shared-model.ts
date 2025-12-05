import { TJsonObject } from '@holistix-forge/simple-types';
import { SharedMap } from '@holistix-forge/collab-engine';

export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawSharedData = {
  'excalidraw:drawing': SharedMap<TExcalidrawDrawing>;
};
