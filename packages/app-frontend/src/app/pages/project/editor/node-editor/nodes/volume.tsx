import { useCallback } from 'react';

import { useNodeContext } from '@monorepo/space';
import { NodeVolume } from '@monorepo/servers';

import { useDispatcher } from '../../../model/collab-model-chunk';

//

export const VolumeNodeLogic = ({
  volume_id,
  volume_name,
  volume_storage,
}: {
  volume_id: number;
  volume_name: string;
  volume_storage: number;
}) => {
  //
  const useNodeValue = useNodeContext();

  const dispatcher = useDispatcher();

  const handleDeleteVolume = useCallback(async () => {
    await dispatcher.dispatch({
      type: 'servers:delete-volume',
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
