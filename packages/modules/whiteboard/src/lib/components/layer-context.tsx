import { createContext, useContext, ReactNode } from 'react';
import {
  TLayerTreeCollection,
  TLayerTreeOperation,
  TLayerTreeItem,
  TLayerTreeData,
  TLayerActions,
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
  /**
   * For a provider that is several layers rather than one.
   *
   * The drawing surface is now: a board is divided into stacked layers and
   * the surface owns all of them, so it publishes its whole section of the
   * panel at once. Publishing them one by one through `updateLayerTree`
   * cannot express a removal — a layer someone deleted would stay in the
   * panel until a reload, because nothing said it was gone.
   */
  updateLayerTrees?: (
    providerId: string,
    layers: TLayerTreeData[],
    actions?: TLayerActions
  ) => void;
  /** What each provider says can be done to its layers, by provider id. */
  layerActions?: Record<string, TLayerActions>;
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
