import { useEffect } from 'react';

import { useDispatcher, useSharedData } from '@monorepo/collab-engine';

import {
  HolistixSpace,
  HolistixSpaceProps,
} from '../components/holistix-space';
import { TSpaceSharedData } from '../space-shared-model';

//

export const STORY_VIEW_ID = 'space-story';

//

/** HolistixSpace but initialise a view with id {STORY_VIEW_ID} */
export const StoryHolistixSpace = (
  props: Omit<HolistixSpaceProps, 'viewId'>
) => {
  const dispatcher = useDispatcher();

  const view = useSharedData<TSpaceSharedData>(['graphViews'], (sd) =>
    sd.graphViews.get(STORY_VIEW_ID)
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
