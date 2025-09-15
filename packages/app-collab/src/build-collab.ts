const u = require('y-websocket/bin/utils');

import {
  BackendEventProcessor,
  TCollaborativeChunk,
  YjsSharedTypes,
  compileChunks,
  YjsSharedEditor,
  EDITORS_YTEXT_YMAP_KEY,
  TCollabNativeEvent,
} from '@monorepo/collab-engine';
import { TCoreEvent } from '@monorepo/core';
import { TabPayload, TTabEvents } from '@monorepo/tabs';
import { TSpaceEvent } from '@monorepo/space';

import { PROJECT } from './project-config';
import { ROOM_ID } from './main';
import { modules } from './modules';
import { CONFIG } from './config';

//
//

const chunks: TCollaborativeChunk[] = modules.map(
  (module) => module.collabChunk
);

//
//

export async function initProjectCollaboration(
  bep: BackendEventProcessor<
    TCoreEvent | TSpaceEvent | TTabEvents<TabPayload> | TCollabNativeEvent,
    unknown
  >
) {
  // create Y document
  const ydoc = u.getYDoc(ROOM_ID);

  const yst = new YjsSharedTypes(ydoc);
  const yse = new YjsSharedEditor(ydoc.getMap(EDITORS_YTEXT_YMAP_KEY));

  const ec = { gateway_init: { project: PROJECT, config: CONFIG, ydoc } };

  const { sharedData, extraContext } = compileChunks(chunks, yst, {
    bep,
    extraContext: ec,
  });

  // load data from saved file
  const loaded = extraContext.gateway.loadDoc();
  const isNew = !loaded;

  // attach data to dispatcher
  bep.bindData(yst, yse, sharedData, {}, extraContext);

  // let every reducers update data from up to date data (API calls ...)
  await bep.process({ type: 'core:load' });

  //
  // new project initialization
  //

  const DEFAULT_VIEW_1 = 'view-1';

  if (isNew) {
    console.log('new project initialization');
    await bep.process({
      type: 'space:new-view',
      viewId: DEFAULT_VIEW_1,
    });
    await bep.process({
      type: 'tabs:add-tab',
      path: [],
      title: 'node-editor-1',
      payload: { type: 'node-editor', viewId: DEFAULT_VIEW_1 },
    });
    await bep.process({
      type: 'tabs:add-tab',
      path: [],
      title: 'resources grid',
      payload: { type: 'resources-grid' },
    });
  }

  //
  //
  //

  //

  (ydoc as any).awareness.on('change', ({ removed }: { removed: number[] }) => {
    // console.log('AWARENESS CHANGES:', { added, updated, removed });
    removed.forEach((userId) => {
      bep.process({
        type: 'user-leave',
        userId: userId,
        awarenessState: (ydoc as any).awareness.getStates().get(userId),
      });
    });
  });

  return { bep };
}
