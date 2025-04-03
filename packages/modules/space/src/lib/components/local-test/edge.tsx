import { FC } from 'react';
import { EdgeProps } from '@xyflow/react';

import { useDebugComponent } from '@monorepo/log';

import {
  EdgeComponent,
  LabelEnd,
  LabelMiddle,
  LabelStart,
} from '../reactflow-renderer/assets/edges/edge';
import { EdgePayload } from '../apis/types/edge';

//
//
//

export const CustomStoryEdge: FC<EdgeProps> = (props) => {
  const debug = useDebugComponent();

  const {
    // edge,
    text = '',
    edgeStyle = 'default',
    endText,
    startText,
  } = props.data as EdgePayload;

  return (
    <EdgeComponent {...(props as any)} type={edgeStyle}>
      {startText && <LabelStart>{startText}</LabelStart>}

      {debug && <LabelMiddle>{text}</LabelMiddle>}

      {endText && <LabelEnd>{endText}</LabelEnd>}

      {/* <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle> */}
    </EdgeComponent>
  );
};
