import { useEffect } from 'react';

import { useLocalSharedData } from '@holistix/collab/frontend';
import { useDispatcher } from '@holistix/reducers/frontend';

import { DemiurgeSpace } from '../components/demiurge-space';
import { TSpaceSharedData } from '../..';

//

export const STORY_VIEW_ID = 'space-story';

//

/** DemiurgeSpace but initialise a view with id {STORY_VIEW_ID} */
export const StoryDemiurgeSpace = () => {
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

  return <DemiurgeSpace viewId={STORY_VIEW_ID} />;
};
