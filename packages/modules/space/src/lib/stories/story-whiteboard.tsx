import { useEffect } from 'react';

import { useLocalSharedData } from '@holistix-forge/collab/frontend';
import { useDispatcher } from '@holistix-forge/reducers/frontend';

import { Whiteboard } from '../components/whiteboard';
import { TSpaceSharedData } from '../..';

//

export const STORY_VIEW_ID = 'space-story';

//

/** Whiteboard but initialise a view with id {STORY_VIEW_ID} */
export const StoryWhiteboard = () => {
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

  return <Whiteboard viewId={STORY_VIEW_ID} projectId={'story-project'} />;
};
