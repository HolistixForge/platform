import { useEffect } from 'react';

import { useLocalSharedData } from '@monorepo/collab/frontend';
import { useDispatcher } from '@monorepo/reducers/frontend';

import {
  HolistixSpace,
  HolistixSpaceWhiteboardProps,
} from '../components/holistix-space';
import { TSpaceSharedData } from '../..';

//

export const STORY_VIEW_ID = 'space-story';

//

/** HolistixSpace but initialise a view with id {STORY_VIEW_ID} */
export const StoryHolistixSpace = (
  props: Omit<HolistixSpaceWhiteboardProps, 'viewId'>
) => {
  const dispatcher = useDispatcher();

  const view = useLocalSharedData<TSpaceSharedData>(
    ['space:graphViews'],
    (sd) => sd['space:graphViews'].get(STORY_VIEW_ID)
  );

  useEffect(() => {
    if (!view) {
      (async () => {
        await dispatcher.dispatch({
          type: 'core:load',
        });
        await dispatcher.dispatch({
          type: 'space:new-view',
          viewId: STORY_VIEW_ID,
        });
      })();
    }
  }, [dispatcher, view]);

  if (!view) {
    return <div>Loading story space...</div>;
  }

  return <HolistixSpace viewId={STORY_VIEW_ID} {...props} />;
};
