import { TJsonObject } from '@holistix/shared-types';
import { SharedMap } from '@holistix/collab-engine';

export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawSharedData = {
  'excalidraw:drawing': SharedMap<TExcalidrawDrawing>;
};
