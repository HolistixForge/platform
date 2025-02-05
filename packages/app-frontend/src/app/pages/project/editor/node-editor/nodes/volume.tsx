import { useCallback } from 'react';

import { useNode } from '@monorepo/demiurge-space';
import { TNodeCommon, TNodeVolume } from '@monorepo/demiurge-types';

import { useDispatcher } from '../../../model/collab-model-chunk';
import { NodeVolume } from '@monorepo/demiurge-ui-components';

//
//
//

export const VolumeNodeLogic = ({
  volume_id,
  volume_name,
  volume_storage,
}: TNodeCommon & TNodeVolume) => {
  //
  const useNodeValue = useNode();

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
