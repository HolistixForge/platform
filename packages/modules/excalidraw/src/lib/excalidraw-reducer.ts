import { RequestData } from '@holistix-forge/reducers';
import {
  TCollabBackendExports,
  ReducerWithCollab,
} from '@holistix-forge/collab';
import { TEventProjectInit } from '@holistix-forge/gateway';
import { EPriority, log } from '@holistix-forge/log';
import { TJsonObject } from '@holistix-forge/simple-types';

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
        return this._migrateLegacyDrawings(requestData).then(() =>
          this._migrateDrawingsOntoViews(requestData)
        );

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
   * Re-key drawings from the node that held them to the view they are on.
   *
   * A drawing used to belong to an ExcalidrawNode and was keyed on that node's
   * id, because the only way to open one was that node's Edit button. The
   * drawing surface belongs to the view now and there is no such node, so a
   * drawing still keyed on one is unreachable — it exists in the shared map
   * and nothing reads it.
   *
   * Which view a drawing belongs to is the view that held its node. That is
   * whiteboard's data, not this module's; reading it from here is a crossing
   * this module makes nowhere else, and it is why this is a migration rather
   * than a permanent lookup. Several node drawings landing on one view are
   * merged, which is safe: element ids are unique across drawings.
   *
   * Runs after `_migrateLegacyDrawings`, on the same `project:init`, so it
   * sees the per-element shape that migration produces. Idempotent the same
   * way: an element is deleted as it is moved, and a drawing already keyed on
   * a view is left alone.
   */
  async _migrateDrawingsOntoViews(requestData: RequestData) {
    const collab = this.getCollab(requestData);
    const elements = collab.sharedData['excalidraw:elements'];
    if (!elements) return;

    // Not in this module's own schema — see the note above.
    const graphViews = (
      collab.sharedData as unknown as {
        'whiteboard:graphViews'?: {
          forEach: (
            fn: (view: { nodeViews?: { id: string }[] }, id: string) => void
          ) => void;
        };
      }
    )['whiteboard:graphViews'];
    if (!graphViews) return;

    /** node id → the view that holds it, and the set of ids that are views. */
    const viewOfNode = new Map<string, string>();
    const viewIds = new Set<string>();
    graphViews.forEach((view, viewId) => {
      viewIds.add(viewId);
      for (const nv of view?.nodeViews ?? []) viewOfNode.set(nv.id, viewId);
    });
    if (!viewIds.size) return;

    const entries: [string, { drawingId: string; element: TJsonObject }][] = [];
    elements.forEach((entry, key) => entries.push([key, entry]));

    let moved = 0;
    for (const [key, entry] of entries) {
      const parsed = parseElementKey(key);
      if (!parsed) continue;
      // Already a view's drawing.
      if (viewIds.has(parsed.drawingId)) continue;

      const viewId = viewOfNode.get(parsed.drawingId);
      // The node is gone from every view. Left where it is rather than
      // guessed at: an unreachable drawing is recoverable, a misfiled one is
      // silently wrong.
      if (!viewId) continue;

      elements.set(elementKey(viewId, parsed.elementId), {
        drawingId: viewId,
        element: entry.element,
      });
      elements.delete(key);
      moved += 1;
    }

    if (moved) {
      log(
        EPriority.Info,
        'EXCALIDRAW',
        `Moved ${moved} element(s) from node-keyed drawings onto their view`
      );
    }
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
