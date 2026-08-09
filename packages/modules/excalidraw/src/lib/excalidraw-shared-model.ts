import { TJsonObject } from '@holistix-forge/simple-types';
import { SharedMap } from '@holistix-forge/collab-engine';

/**
 * One Excalidraw element, addressed on its own.
 *
 * A drawing used to be a single entry — the whole element array plus a
 * serialized SVG of it — so every stroke rewrote all of it, and the only
 * conflict resolution was "the last writer replaces the other's scene".
 * Two people drawing at the same time lost each other's work.
 *
 * One entry per element instead, so the shared map's own per-key concurrency
 * does the work: two people editing two elements never touch the same key.
 */
export type TExcalidrawElementEntry = {
  /** The ExcalidrawNode this element belongs to. Also encoded in the key. */
  drawingId: string;
  /** The element itself, carrying Excalidraw's own `version`/`versionNonce`. */
  element: TJsonObject;
};

/**
 * Keys are `<drawingId>::<elementId>`.
 *
 * Both ids are generated (uuid, nanoid) and contain no `::`, but the parse
 * splits on the *first* separator anyway so an unexpected id cannot silently
 * reassign an element to another drawing.
 */
const KEY_SEPARATOR = '::';

export const elementKey = (drawingId: string, elementId: string): string =>
  `${drawingId}${KEY_SEPARATOR}${elementId}`;

export const parseElementKey = (
  key: string
): { drawingId: string; elementId: string } | undefined => {
  const at = key.indexOf(KEY_SEPARATOR);
  if (at <= 0) return undefined;
  const elementId = key.slice(at + KEY_SEPARATOR.length);
  if (!elementId) return undefined;
  return { drawingId: key.slice(0, at), elementId };
};

/**
 * A layer of a drawing, and where it sits in the stack.
 *
 * Layers are not a second canvas. Excalidraw's scene is an ordered array and
 * that order *is* the paint order, so a layer is a contiguous block in it —
 * reordering layers reorders their blocks, and the whole thing costs one
 * canvas and one render. Two stacked Excalidraw instances would have doubled
 * the cost measured at 2000 nodes, and left a focus and a z-order to arbitrate
 * between them.
 *
 * `order` is a number rather than a position in a list because this is a
 * shared map and two people may reorder at once: per-key last-writer-wins on
 * a number converges on *an* order, where a shared list rebuilt by two
 * writers can converge on a list with holes in it.
 */
export type TExcalidrawLayer = {
  id: string;
  /** The drawing this layer belongs to — a view, today. */
  drawingId: string;
  title: string;
  /** Ascending, back to front. The front of the stack has the largest. */
  order: number;
};

/** Keys are `<drawingId>::<layerId>`, as elements are. */
export const layerKey = (drawingId: string, layerId: string): string =>
  `${drawingId}${KEY_SEPARATOR}${layerId}`;

/**
 * The layer an element is on, or nothing for one drawn before layers existed.
 *
 * Nothing is not an error and does not need repairing: an untagged element
 * belongs to the bottom of the stack, which is where it was when it was the
 * only place there was.
 */
export const elementLayerId = (element: TJsonObject): string | undefined => {
  const custom = element['customData'] as Record<string, unknown> | undefined;
  const id = custom?.['holistixLayer'];
  return typeof id === 'string' ? id : undefined;
};

export type TExcalidrawSharedData = {
  'excalidraw:elements': SharedMap<TExcalidrawElementEntry>;
  'excalidraw:layers': SharedMap<TExcalidrawLayer>;
};

/**
 * The shape before the split: one entry per drawing, holding every element
 * and a serialized SVG of them.
 *
 * Registered on the backend only, and only so the migration can read it.
 * Nothing writes to it any more; each drawing is deleted as it is moved
 * across, which is what makes the migration idempotent — a second run finds
 * nothing left to move.
 */
export type TExcalidrawLegacyDrawing = {
  elements: TJsonObject[];
  fromUser: string;
  svg: string;
};

export type TExcalidrawLegacySharedData = {
  'excalidraw:drawing': SharedMap<TExcalidrawLegacyDrawing>;
};
