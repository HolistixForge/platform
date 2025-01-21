import { FC } from 'react';
import { EdgeProps } from 'reactflow';

import {
  EdgeComponent,
  LabelMiddle,
} from '../reactflow-renderer/assets/edges/edge';
import { TAnyEdge } from '@monorepo/demiurge-types';

//
//
//

type EdgePayload = { text: string; edge: TAnyEdge };

//

export const CustomStoryEdge: FC<EdgeProps<EdgePayload>> = (props) => {
  const { edge } = props.data as EdgePayload;

  const type =
    edge?.data?.demiurge_type === 'chat-anchor' ? 'straight' : 'default';

  return (
    <EdgeComponent {...props} type={type}>
      <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle>
    </EdgeComponent>
  );
};
