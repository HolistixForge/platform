import { BackendEventProcessor } from '@holistix-forge/reducers';
import { TCoreEvent } from '@holistix-forge/core-graph';
import { TabPayload, TTabEvents } from '@holistix-forge/tabs';
import { TSpaceEvent } from '@holistix-forge/space';

//
//

export async function initProjectCollaboration(
  bep: BackendEventProcessor<TCoreEvent | TSpaceEvent | TTabEvents<TabPayload>>
) {
  // TODO: load data from saved file
  // const loaded = extraContext.gateway.loadDoc();
  const isNew = false; // TODO: Determine if this is a new project

  // let every reducers update data from up to date data (API calls ...)
  // await bep.processEvent({ type: 'core:load' }, requestData);

  //
  // new project initialization
  //

  // const DEFAULT_VIEW_1 = 'view-1';

  if (isNew) {
    console.log('new project initialization');
    // TODO: Implement new project initialization with proper requestData
    // await bep.processEvent({
    //   type: 'space:new-view',
    //   viewId: DEFAULT_VIEW_1,
    // }, requestData);
    // await bep.processEvent({
    //   type: 'tabs:add-tab',
    //   path: [],
    //   title: 'node-editor-1',
    //   payload: { type: 'node-editor', viewId: DEFAULT_VIEW_1 },
    // }, requestData);
    // await bep.processEvent({
    //   type: 'tabs:add-tab',
    //   path: [],
    //   title: 'resources grid',
    //   payload: { type: 'resources-grid' },
    // }, requestData);
  }

  return { bep };
}
