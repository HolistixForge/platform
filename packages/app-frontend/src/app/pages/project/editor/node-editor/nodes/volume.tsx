import { useCallback } from 'react';

import { useNodeContext } from '@monorepo/space';
import { TNodeVolume } from '@monorepo/demiurge-types';
import { NodeVolume } from '@monorepo/servers';

import { useDispatcher } from '../../../model/collab-model-chunk';

//

export const VolumeNodeLogic = ({
  volume_id,
  volume_name,
  volume_storage,
}: TNodeCommon & TNodeVolume) => {
  //
  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher();

  const handleDeleteVolume = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'delete-volume',
      volume_id,
    });
  }, [dispatcher, volume_id]);

  return (
    <NodeVolume
      {...useNodeValue}
      volume_name={volume_name}
      volume_storage={volume_storage}
      onDelete={handleDeleteVolume}
    />
  );
};
