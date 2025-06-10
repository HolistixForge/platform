import { FC } from 'react';
import { EdgeProps } from '@xyflow/react';

import { useDebugComponent } from '@monorepo/log';

import {
  EdgeComponent,
  LabelEnd,
  LabelMiddle,
  LabelStart,
} from './assets/edges/edge';
import { ReactflowEdgePayload } from './apis/types/edge';

//
//
//

export const CustomStoryEdge: FC<EdgeProps> = (props) => {
  const debug = useDebugComponent();

  const { text = '', endText, startText } = props.data as ReactflowEdgePayload;

  return (
    <EdgeComponent {...props}>
      {startText && <LabelStart>{startText}</LabelStart>}

      {debug && <LabelMiddle>{text}</LabelMiddle>}

      {endText && <LabelEnd>{endText}</LabelEnd>}

      {/* <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle> */}
    </EdgeComponent>
  );
};
