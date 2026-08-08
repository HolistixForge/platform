import { RequestData } from '@holistix-forge/reducers';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';
import { TEventProjectInit } from '@holistix-forge/gateway';
import { EPriority, log } from '@holistix-forge/log';

import {
  TExcalidrawEvent,
  TEventExcalidrawUpsertElements,
  TEventExcalidrawDeleteElements,
  TEventExcalidrawDeleteDrawing,
} from './excalidraw-events';
import {
  TExcalidrawSharedData,
  TExcalidrawLegacySharedData,
  TExcalidrawLegacyDrawing,
  elementKey,
  parseElementKey,
} from './excalidraw-shared-model';
import { withStackingIndex } from './excalidraw-scene';

//

type TRequired = {
  collab: TCollabBackendExports;
};

/**
 * The writer for `excalidraw:elements`.
 *
 * Until now the excalidraw module had no reducer at all: it registered its
 * shared data and let the browser write to Yjs directly. It was the only
 * module doing that, and it is why the drawing had no server-side owner —
 * nothing could arbitrate, so the last writer won the whole scene.
 */
export class ExcalidrawReducer extends ReducerWithCollab<
  TExcalidrawEvent | TEventProjectInit,
  TExcalidrawSharedData & TExcalidrawLegacySharedData
> {
  constructor(depsExports: TRequired) {
    super(depsExports.collab.registry, 'excalidraw');
  }

  override reduce(
    event: TExcalidrawEvent | TEventProjectInit,
    requestData: RequestData
  ): Promise<void> {
    switch (event.type) {
      case 'excalidraw:upsert-elements':
        return this._upsertElements(event, requestData);

      case 'excalidraw:delete-elements':
        return this._deleteElements(event, requestData);

      case 'excalidraw:delete-drawing':
        return this._deleteDrawing(event, requestData);

      case 'project:init':
        return this._migrateLegacyDrawings(requestData);

      default:
        return Promise.resolve();
    }
  }

  /**
   * Move drawings written in the old one-entry-per-drawing shape across to
   * one entry per element.
   *
   * Runs on `project:init`, which the gateway dispatches once per project
   * room after any snapshot is applied — server side, one writer, and before
   * a client can have drawn anything.
   *
   * Idempotent by construction rather than by a version marker: each drawing
   * is deleted as it is moved, so a second run has nothing to move. Two runs
   * racing each other write the same keys with the same values, because the
   * keys are derived from the data, so a duplicate is a no-op rather than a
   * duplicated element.
   */
  async _migrateLegacyDrawings(requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const legacy = collab.sharedData['excalidraw:drawing'];
    const elements = collab.sharedData['excalidraw:elements'];

    // A deployment that never registered the legacy map, or a fresh project.
    if (!legacy || !elements) return;

    const drawings: [string, TExcalidrawLegacyDrawing][] = [];
    legacy.forEach((drawing, drawingId) => drawings.push([drawingId, drawing]));
    if (!drawings.length) return;

    let moved = 0;
    for (const [drawingId, drawing] of drawings) {
      for (const element of withStackingIndex(drawing?.elements ?? [])) {
        const id =
          typeof element['id'] === 'string' ? element['id'] : undefined;
        if (!id) continue;
        elements.set(elementKey(drawingId, id), { drawingId, element });
        moved += 1;
      }
      legacy.delete(drawingId);
    }

    log(
      EPriority.Info,
      'EXCALIDRAW',
      `Migrated ${drawings.length} drawing(s), ${moved} element(s), to per-element storage`
    );
  }

  /**
   * One `set` per element, so two people drawing at once write two keys.
   */
  async _upsertElements(
    event: TEventExcalidrawUpsertElements,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const elements = collab.sharedData['excalidraw:elements'];

    for (const element of event.elements) {
      const id = typeof element['id'] === 'string' ? element['id'] : undefined;
      // An element with no id has no key, so it could only be written under a
      // made-up one and would never be found again. Dropping it loses a
      // stroke; keeping it would corrupt the map quietly.
      if (!id) continue;

      elements.set(elementKey(event.drawingId, id), {
        drawingId: event.drawingId,
        element,
      });
    }
  }

  async _deleteElements(
    event: TEventExcalidrawDeleteElements,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const elements = collab.sharedData['excalidraw:elements'];

    for (const id of event.elementIds) {
      elements.delete(elementKey(event.drawingId, id));
    }
  }

  /**
   * Collect first, delete after: deleting while iterating a shared map is not
   * a contract any of the backends promise.
   */
  async _deleteDrawing(
    event: TEventExcalidrawDeleteDrawing,
    requestData: RequestData
  ) {
    const collab = this.getCollab(requestData);
    const elements = collab.sharedData['excalidraw:elements'];

    const keys: string[] = [];
    elements.forEach((_entry, key) => {
      if (parseElementKey(key)?.drawingId === event.drawingId) keys.push(key);
    });

    for (const key of keys) elements.delete(key);
  }
}
