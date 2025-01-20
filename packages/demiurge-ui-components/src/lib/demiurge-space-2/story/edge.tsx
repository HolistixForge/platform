import { FC } from 'react';
import { EdgeProps } from 'reactflow';

import { useDebugComponent } from '@monorepo/log';
import {
  EdgeComponent,
  LabelEnd,
  LabelMiddle,
} from '../reactflow-renderer/assets/edges/edge';
import { TAnyEdge } from '@monorepo/demiurge-types';

//
//
//

type EdgePayload = { text: string; edge: TAnyEdge };

//

export const CustomStoryEdge: FC<EdgeProps<EdgePayload>> = (props) => {
  const debug = useDebugComponent();

  const { text, edge } = props.data as EdgePayload;

  const toData = edge?.to.data;

  const type =
    edge?.data?.demiurge_type === 'chat-anchor' ? 'straight' : 'default';

  return (
    <EdgeComponent {...props} type={type}>
      {debug && <LabelMiddle className="debug-edge-label">{text}</LabelMiddle>}
      {toData && <LabelEnd>coucou</LabelEnd>}
    </EdgeComponent>
  );
};
