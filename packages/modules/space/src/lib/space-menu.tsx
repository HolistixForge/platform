import { FrontendDispatcher } from '@monorepo/collab-engine';
import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import { makeUuid } from '@monorepo/simple-types';

import { SHAPE_TYPES, TEventNewShape, TSpaceEvent } from './space-events';

//

export const spaceMenuEntries: TSpaceMenuEntries = ({
  viewId,
  from,
  sharedData,
  position,
  renderForm,
  dispatcher,
}) => {
  const d = dispatcher as FrontendDispatcher<TSpaceEvent>;
  return [
    {
      type: 'item',
      label: 'New Group',
      onClick: () => {
        d.dispatch({
          type: 'space:new-group',
          groupId: makeUuid(),
          title: 'New Group',
          origin: {
            viewId: viewId,
            position: position(),
          },
        });
      },
    },
    {
      type: 'item',
      label: 'New Shape',
      onClick: () => {
        const event: TEventNewShape = {
          type: 'space:new-shape',
          shapeId: makeUuid(),
          shapeType: SHAPE_TYPES.CIRCLE, // Default to circle
          origin: {
            viewId: viewId,
            position: position(),
          },
        };
        d.dispatch(event);
      },
    },
  ];
};
