import { FC } from 'react';
import { EdgeProps } from 'reactflow';
import { TrashIcon } from '@radix-ui/react-icons';

import { useDebugComponent } from '@monorepo/log';
import { SpaceEdgePayload } from '@monorepo/demiurge-space';
import {
  ButtonIcon,
  EdgeComponent,
  LabelEnd,
  LabelMiddle,
  useAction,
} from '@monorepo/demiurge-ui-components';
import {
  TAnyEdge,
  TEdgeMount,
  TNodeServer,
  TNodeVolume,
} from '@monorepo/demiurge-types';

import { useDispatcher, useSharedData } from '../../model/collab-model-chunk';

//
//
//

export const CustomEdge: FC<EdgeProps<SpaceEdgePayload>> = (props) => {
  const debug = useDebugComponent();

  const { text, edge } = props.data as SpaceEdgePayload;

  const toData = edge?.to.data;

  const type =
    edge?.data?.demiurge_type === 'chat-anchor' ? 'straight' : 'default';

  return (
    <EdgeComponent {...props} type={type}>
      {debug && <LabelMiddle className="debug-edge-label">{text}</LabelMiddle>}
      {toData && (
        <LabelEnd>
          <EdgeTargetLabel edge={edge} />
        </LabelEnd>
      )}
    </EdgeComponent>
  );
};

//
//
//

type EdgeTargetLabelProps = {
  edge: TAnyEdge;
};

/**
 * Label at the end of an edge (by the target node)
 */
const EdgeTargetLabel = (props: EdgeTargetLabelProps) => {
  const type = props.edge.data.demiurge_type;

  switch (type) {
    case 'mount':
      return <MountTargetLabel {...props} />;

    default:
      return null;
  }
};

//
//
//

const MountTargetLabel = ({ edge }: EdgeTargetLabelProps) => {
  const nodeData = useSharedData(['nodeData'], (sd) => sd.nodeData);
  const dispatcher = useDispatcher();

  const deleteButton = useAction(() => {
    const s = nodeData.get(edge.to.node) as TNodeServer;
    const v = nodeData.get(edge.from.node) as TNodeVolume;
    return dispatcher.dispatch({
      type: 'unmount-volume',
      project_server_id: s.project_server_id,
      volume_id: v.volume_id,
      mount_point: (edge as TEdgeMount).to.data.mount_point,
    });
  }, [dispatcher, edge, nodeData]);

  return (
    <>
      {edge.to.data.mount_point}
      <ButtonIcon
        {...deleteButton}
        Icon={TrashIcon}
        className="edge-label-icon red"
        style={{ marginLeft: '7px' }}
      />
    </>
  );
};
