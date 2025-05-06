import { FC } from 'react';
import { EdgeProps } from '@xyflow/react';

import { useDebugComponent } from '@monorepo/log';

import {
  EdgeComponent,
  LabelEnd,
  LabelMiddle,
  LabelStart,
} from './assets/edges/edge';
import { EdgePayload } from '../apis/types/edge';
import { FloatingEdge } from './assets/edges/floating-edge';

//
//
//

export const CustomStoryEdge: FC<EdgeProps> = (props) => {
  const debug = useDebugComponent();

  const { edge, text = '', endText, startText } = props.data as EdgePayload;

  if (edge.type === 'easy-connect') {
    return <FloatingEdge {...props} />;
  }

  return (
    <EdgeComponent {...props}>
      {startText && <LabelStart>{startText}</LabelStart>}

      {debug && <LabelMiddle>{text}</LabelMiddle>}

      {endText && <LabelEnd>{endText}</LabelEnd>}

      {/* <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle> */}
    </EdgeComponent>
  );
};
