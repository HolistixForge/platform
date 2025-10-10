import {
  BackendEventProcessor,
  TCollabNativeEvent,
} from '@monorepo/collab-engine';
import { TCoreEvent } from '@monorepo/core-graph';
import { TabPayload, TTabEvents } from '@monorepo/tabs';
import { TSpaceEvent } from '@monorepo/space';

//
//

export async function initProjectCollaboration(
  bep: BackendEventProcessor<
    TCoreEvent | TSpaceEvent | TTabEvents<TabPayload> | TCollabNativeEvent,
    unknown
  >
) {
  // load data from saved file
  const loaded = extraContext.gateway.loadDoc();
  const isNew = !loaded;

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

  return { bep };
}
