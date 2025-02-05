import { useCallback } from 'react';

import { useFactory } from '@monorepo/lazy-factory';
import { TNodeVideo } from '@monorepo/demiurge-types';
import { useNodeContext } from '@monorepo/space';
import { NodeVideo } from '@monorepo/ui-views';

import { useDispatcher } from '../../../model/collab-model-chunk';

//

export const VideoNodeLogic = ({ id, youtubeId }: TNodeCommon & TNodeVideo) => {
  //

  const useNodeValue = useNodeContext();

  const { Component: Youtube } = useFactory('socials:youtube', ['DOM'], null);

  const dispatcher = useDispatcher();

  const handleDelete = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'delete-node',
      id,
    });
  }, [dispatcher, id]);

  //

  return (
    <NodeVideo
      youtubeId={youtubeId}
      Youtube={Youtube}
      {...useNodeValue}
      onDelete={handleDelete}
    />
  );
};
