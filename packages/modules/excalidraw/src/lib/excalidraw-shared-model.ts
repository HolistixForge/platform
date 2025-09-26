import { TJsonObject } from '@monorepo/simple-types';
import { SharedMap, SharedTypes } from '@monorepo/collab-engine';

export type TExcalidrawDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawSharedData = {
  excalidrawDrawing: SharedMap<TExcalidrawDrawing>;
};

export const Excalidraw_loadData = (st: SharedTypes): TExcalidrawSharedData => {
  return {
    excalidrawDrawing:
      st.getSharedMap<TExcalidrawDrawing>('excalidraw-drawing'),
  };
};
