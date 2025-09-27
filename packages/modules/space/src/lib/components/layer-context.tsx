import { createContext, useContext, ReactNode } from 'react';
import {
  TLayerTreeCollection,
  TLayerTreeOperation,
  TLayerTreeItem,
} from '../layer-tree-types';

export type LayerContextValue = {
  activeLayerId: string | null;
  activeLayerPayload: any;
  activateLayer: (layerId: string, payload?: any) => void;
  // Tree data for layer panel
  treeCollection?: TLayerTreeCollection;
  onTreeOperation?: (operation: TLayerTreeOperation) => void;
  // API for layers to update their tree data
  updateLayerTree?: (
    layerId: string,
    items: TLayerTreeItem[],
    title: string
  ) => void;
};

export const LayerContext = createContext<LayerContextValue | null>(null);

export const useLayerContext = () => {
  const context = useContext(LayerContext);
  if (!context) {
    throw new Error(
      'useLayerContext must be used within a LayerContext.Provider'
    );
  }
  return context;
};

export const LayerContextProvider = ({
  children,
  value,
}: {
  children: ReactNode;
  value: LayerContextValue;
}) => {
  return (
    <LayerContext.Provider value={value}>{children}</LayerContext.Provider>
  );
};
