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

export type TExcalidrawEvent =
  | TEventExcalidrawUpsertElements
  | TEventExcalidrawDeleteElements
  | TEventExcalidrawDeleteDrawing;
