import { FC } from 'react';
import { EdgeProps } from 'reactflow';

import {
  EdgeComponent,
  LabelMiddle,
} from '../reactflow-renderer/assets/edges/edge';
import { EdgePayload } from '../apis/types/edge';

//
//
//

export const CustomStoryEdge: FC<EdgeProps<EdgePayload>> = (props) => {
  const { edge } = props.data as EdgePayload;

  return (
    <EdgeComponent {...props} type={'default'}>
      <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle>
    </EdgeComponent>
  );
};
