import { TJsonObject } from '@holistix-forge/simple-types';

import {
  TExcalidrawSharedData,
  TExcalidrawElementEntry,
  parseElementKey,
} from './excalidraw-shared-model';

/**
 * The elements of one drawing, read out of the per-element shared map.
 *
 * Sorted by Excalidraw's own fractional index so the scene keeps its stacking
 * order: the map is keyed, not ordered, and reading it back in insertion order
 * would let a remote update silently restack a drawing.
 */
export const readDrawingElements = (
  sharedData: TExcalidrawSharedData,
  drawingId: string
): TJsonObject[] => {
  if (!drawingId) return [];

  const entries: [string, TExcalidrawElementEntry][] = [];
  sharedData['excalidraw:elements'].forEach((entry, key) =>
    entries.push([key, entry])
  );

  return pickDrawingElements(entries, drawingId);
};

/**
 * The same selection over a plain map.
 *
 * `useLocalSharedData` hands components a copy rather than the live shared
 * map, which is what makes them re-render; this is the read for that side.
 */
export const pickDrawingElements = (
  entries: Iterable<[string, TExcalidrawElementEntry]>,
  drawingId: string
): TJsonObject[] => {
  if (!drawingId) return [];

  const out: TJsonObject[] = [];
  for (const [key, entry] of entries) {
    if (parseElementKey(key)?.drawingId !== drawingId) continue;
    out.push(entry.element);
  }

  return out.sort((a, b) => {
    const ia = typeof a['index'] === 'string' ? a['index'] : '';
    const ib = typeof b['index'] === 'string' ? b['index'] : '';
    if (ia === ib) return 0;
    return ia < ib ? -1 : 1;
  });
};

/** `id` → `version`, the shape the change diff compares against. */
export const versionsById = (
  elements: readonly TJsonObject[]
): Map<string, number> => {
  const versions = new Map<string, number>();
  for (const element of elements) {
    const id = typeof element['id'] === 'string' ? element['id'] : undefined;
    if (!id) continue;
    versions.set(
      id,
      typeof element['version'] === 'number' ? element['version'] : 0
    );
  }
  return versions;
};
