import { FC } from 'react';
import { EdgeProps } from 'reactflow';

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

export const CustomStoryEdge: FC<EdgeProps<EdgePayload>> = (props) => {
  const debug = useDebugComponent();

  const {
    edge,
    text = '',
    style = 'default',
    endText,
    startText,
  } = props.data as EdgePayload;

  return (
    <EdgeComponent {...props} type={style}>
      {startText && <LabelStart>{startText}</LabelStart>}

      {debug && <LabelMiddle className="debug-edge-label">{text}</LabelMiddle>}

      {endText && <LabelEnd>{endText}</LabelEnd>}

      <LabelMiddle className="debug-edge-label">{edge.type}</LabelMiddle>
    </EdgeComponent>
  );
};
