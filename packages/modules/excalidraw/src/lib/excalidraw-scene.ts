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

/**
 * Give a drawing's elements an explicit stacking index when they have none.
 *
 * Order used to be carried by the array. A keyed map has no order, so it is
 * carried by Excalidraw's fractional `index` instead — and a drawing written
 * before that field existed would come back in whatever order the map yields,
 * silently restacked.
 *
 * Synthesized for the whole drawing at once, never element by element: real
 * and synthetic indices sort against each other in ways that depend on
 * Excalidraw's alphabet, so the two must not interleave.
 */
export const withStackingIndex = (
  elements: readonly TJsonObject[]
): TJsonObject[] => {
  const complete = elements.every((e) => typeof e['index'] === 'string');
  if (complete) return [...elements];

  const width = String(Math.max(elements.length - 1, 0)).length;
  return elements.map((element, i) => ({
    ...element,
    index: `a${String(i).padStart(width, '0')}`,
  }));
};

/**
 * What a scene looks like right now, as one comparable string.
 *
 * Excalidraw calls `onChange` for everything, including the `appState` writes
 * our own viewport sync makes — so a handler that reacts to every call reacts
 * to itself. This is the value a handler compares against to tell an actual
 * edit from an echo. Versions rather than contents: Excalidraw bumps `version`
 * on every mutation, so there is nothing to gain from stringifying the scene.
 */
export const sceneSignature = (elements: readonly TJsonObject[]): string =>
  elements
    .map(
      (e) =>
        `${String(e['id'])}@${String(e['version'])}${e['isDeleted'] ? '!' : ''}`
    )
    .join(',');

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
