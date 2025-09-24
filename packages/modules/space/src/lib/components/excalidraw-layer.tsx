import { useEffect, useCallback, useRef, useMemo } from 'react';
import { Excalidraw } from '@excalidraw/excalidraw';
import { INITIAL_VIEWPORT, Viewport, WhiteboardMode } from './holistix-space';

import '@excalidraw/excalidraw/index.css';
import { OrderedExcalidrawElement } from '@excalidraw/excalidraw/element/types';
import { AppState, Collaborator, SocketId } from '@excalidraw/excalidraw/types';
import { BinaryFiles } from '@excalidraw/excalidraw/types';
import {
  useAwarenessUserList,
  useSharedDataDirect,
} from '@monorepo/collab-engine';
import { TSpaceSharedData } from '../space-shared-model';
import { TJsonObject } from '@monorepo/simple-types';
import debounce from 'lodash/debounce';

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
    viewModeEnabled: true, // Enable view mode when not in drawing mode
    zenModeEnabled: false,
    gridSize: undefined,
    theme: 'light' as any,
    viewBackgroundColor: 'transparent',
  };
};

//

interface ExcalidrawLayerProps {
  viewId: string;
  mode: WhiteboardMode;
  onViewportChange?: (viewport: Viewport) => void;
  registerViewportChangeCallback: (
    callback: (viewport: Viewport) => void
  ) => void;
}

//

// Simple fast hash function for objects/arrays
function simpleHash(obj: any): string {
  const str = JSON.stringify(obj);
  let hash = 0,
    i,
    chr;
  if (str.length === 0) return hash.toString();
  for (i = 0; i < str.length; i++) {
    chr = str.charCodeAt(i);
    hash = (hash << 5) - hash + chr;
    hash |= 0; // Convert to 32bit integer
  }
  return hash.toString();
}

export const ExcalidrawLayer = ({
  viewId,
  mode,
  onViewportChange,
  registerViewportChangeCallback,
}: ExcalidrawLayerProps) => {
  //

  // viewport sync

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

  // collaborative

  const users = useAwarenessUserList();
  // Build collaborators map from user list (using username as key)
  const collaborators = useMemo(() => {
    const map = new Map<SocketId, Collaborator>();
    users.forEach((u) => {
      map.set(u.username as any, {
        username: u.username,
        color: { background: u.color, stroke: u.color },
      });
    });
    return map;
  }, [users]);

  //

  const sharedData = useSharedDataDirect<TSpaceSharedData>();

  // Store last applied hash to avoid unnecessary updates and infinite loops
  const lastHashRef = useRef<string | null>(null);

  // Debounced function for setting drawing data
  const debouncedSetDrawing = useRef(
    debounce(
      (elements: any, hash: string) => {
        sharedData.drawing.set(viewId, { elements, hash });
      },
      250,
      { maxWait: 250 }
    )
  ).current;

  useEffect(() => {
    // On mount, ensure drawing entry exists
    const d = sharedData.drawing.get(viewId);
    if (!d) {
      const elements: TJsonObject[] = [];
      const hash = simpleHash(elements);
      sharedData.drawing.set(viewId, {
        elements,
        hash,
      });
      lastHashRef.current = hash;
    } else {
      lastHashRef.current = d.hash as string;
    }
    // Observe remote changes
    sharedData.drawing.observe(() => {
      const me = sharedData.drawing.get(viewId);
      if (me && me.hash !== lastHashRef.current) {
        lastHashRef.current = me.hash as string;
        if (ref && 'current' in ref && ref.current) {
          ref.current.updateScene({
            elements: structuredClone(me.elements) || [],
          });
        }
      }
    });
  }, [sharedData]);

  //

  const handleChange = useCallback(
    (
      elements: readonly OrderedExcalidrawElement[],
      appState: AppState,
      files: BinaryFiles
    ) => {
      const newHash = simpleHash(elements);
      if (newHash === lastHashRef.current) {
        return; // No actual change
      }
      lastHashRef.current = newHash as string;
      debouncedSetDrawing(elements as any, newHash);
    },
    [sharedData, viewId]
  );

  // mode switch, collaborators update, content update

  useEffect(() => {
    if (ref && 'current' in ref && ref.current) {
      ref.current.updateScene({
        appState: {
          ...ref.current.getAppState(),
          ...makeAppState(mode),
          collaborators,
        },
      });
    }
  }, [mode, collaborators]);

  // Cancel debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSetDrawing.cancel();
    };
  }, [debouncedSetDrawing]);

  //

  return (
    <div
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        pointerEvents: 'all',
        zIndex: 0,
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
          elements:
            (structuredClone(
              sharedData.drawing.get(viewId)?.elements
            ) as any) || [],
        }}
        onChange={handleChange}
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
