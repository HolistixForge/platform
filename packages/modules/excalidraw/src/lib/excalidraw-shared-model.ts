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

export type TExcalidrawSharedData = {
  'excalidraw:elements': SharedMap<TExcalidrawElementEntry>;
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
