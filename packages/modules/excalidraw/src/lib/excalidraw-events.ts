import { TJsonObject } from '@holistix-forge/simple-types';

/**
 * The module used to write straight into Yjs from the browser, through
 * `useSharedDataDirect`. Every other module goes through an event and a
 * backend reducer, and that is what makes the gateway the single writer.
 * These events put Excalidraw back on that path.
 */

/** Elements created or modified. Carries only what changed, not the scene. */
export type TEventExcalidrawUpsertElements = {
  type: 'excalidraw:upsert-elements';
  drawingId: string;
  elements: TJsonObject[];
};

/** Elements removed from a drawing. */
export type TEventExcalidrawDeleteElements = {
  type: 'excalidraw:delete-elements';
  drawingId: string;
  elementIds: string[];
};

/** Every element of a drawing, when the drawing node itself goes away. */
export type TEventExcalidrawDeleteDrawing = {
  type: 'excalidraw:delete-drawing';
  drawingId: string;
};

/**
 * A new layer, on top of the stack.
 *
 * The id is minted by the caller so the browser can put an element on it in
 * the same breath, rather than drawing into nowhere while it waits to be told
 * what the layer is called.
 */
export type TEventExcalidrawNewLayer = {
  type: 'excalidraw:new-layer';
  drawingId: string;
  layerId: string;
  title: string;
};

/**
 * The whole stack, back to front.
 *
 * The order arrives complete rather than as "move this one there": a move is
 * only meaningful against the list the mover was looking at, and two people
 * moving at once against different lists produce an order neither of them
 * asked for. A full list is the state they intended.
 */
export type TEventExcalidrawReorderLayers = {
  type: 'excalidraw:reorder-layers';
  drawingId: string;
  layerIds: string[];
};

export type TEventExcalidrawRenameLayer = {
  type: 'excalidraw:rename-layer';
  drawingId: string;
  layerId: string;
  title: string;
};

export type TExcalidrawEvent =
  | TEventExcalidrawNewLayer
  | TEventExcalidrawReorderLayers
  | TEventExcalidrawRenameLayer
  | TEventExcalidrawUpsertElements
  | TEventExcalidrawDeleteElements
  | TEventExcalidrawDeleteDrawing;
