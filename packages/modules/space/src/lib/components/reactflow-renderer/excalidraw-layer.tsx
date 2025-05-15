import { useEffect, useCallback, useRef } from 'react';
import {
  convertToExcalidrawElements,
  Excalidraw,
} from '@excalidraw/excalidraw';
import { INITIAL_VIEWPORT, Viewport, WhiteboardMode } from './demiurge-space';

import '@excalidraw/excalidraw/index.css';

//

const toExcalidrawViewport = (viewport: Viewport) => {
  return {
    scrollX: viewport.absoluteX,
    scrollY: viewport.absoluteY,
    zoom: { value: viewport.zoom as any },
  };
};

const makeAppState = (mode: WhiteboardMode) => {
  return {
    viewModeEnabled: mode !== 'drawing', // Enable view mode when not in drawing mode
    zenModeEnabled: false,
    gridSize: undefined,
    theme: 'light' as any,
    viewBackgroundColor: 'transparent',
  };
};

//

interface ExcalidrawLayerProps {
  mode: WhiteboardMode;
  onViewportChange?: (viewport: Viewport) => void;
  registerViewportChangeCallback: (
    callback: (viewport: Viewport) => void
  ) => void;
}

//

export const ExcalidrawLayer = ({
  mode,
  onViewportChange,
  registerViewportChangeCallback,
}: ExcalidrawLayerProps) => {
  //

  const ref = useRef<any>(null);

  const setViewport = useCallback((viewport: Viewport) => {
    if (ref && 'current' in ref && ref.current) {
      const state = ref.current.getAppState();
      const vp = toExcalidrawViewport(viewport);
      ref.current.updateScene({
        appState: {
          ...state,
          ...vp,
        },
      });
    }
  }, []);

  useEffect(() => {
    registerViewportChangeCallback(setViewport);
  }, []);

  //
  useEffect(() => {
    if (ref && 'current' in ref && ref.current) {
      // Update Excalidraw state based on drawing mode
      console.log('change mode', mode);
      ref.current.updateScene({
        appState: {
          ...ref.current.getAppState(),
          ...makeAppState(mode),
        },
      });
    }
  }, [mode]);

  //

  const handleScrollChange = (
    scrollX: number,
    scrollY: number,
    zoom: { value: number }
  ) => {
    if (onViewportChange) {
      onViewportChange({
        absoluteX: scrollX,
        absoluteY: scrollY,
        zoom: zoom.value,
      });
    }
  };

  const elements = convertToExcalidrawElements([
    /*
    {
      type: 'rectangle',
      x: 0,
      y: 0,
      width: 100,
      height: 100,
      strokeColor: '#ff2222',
      backgroundColor: '#ff2222',
      fillStyle: 'hachure',
    },
    */
  ]);

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: mode === 'drawing' ? 'all' : 'none',
        zIndex: 4,
      }}
    >
      <Excalidraw
        excalidrawAPI={(api) => {
          if (ref && 'current' in ref) {
            ref.current = api;
          }
        }}
        initialData={{
          appState: {
            ...makeAppState(mode),
            ...toExcalidrawViewport(INITIAL_VIEWPORT),
          },
          elements,
        }}
        UIOptions={{
          canvasActions: {
            loadScene: false,
            saveToActiveFile: false,
            export: false,
            saveAsImage: false,
            changeViewBackgroundColor: false,
            clearCanvas: false,
          },
          tools: {
            image: false,
          },
        }}
        onScrollChange={handleScrollChange}
      />
    </div>
  );
};
