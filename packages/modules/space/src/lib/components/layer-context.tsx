import { createContext, useContext, ReactNode } from 'react';

export type LayerContextValue = {
  activeLayerId: string | null;
  activeLayerPayload: any;
  activateLayer: (layerId: string, payload?: any) => void;
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
