import { TNodeContext, InputsAndOutputs } from '@monorepo/space';
import { useMakeButton } from '@monorepo/space';

import { ChatboxLogic, ChatboxLogicProps } from './chatbox-logic';

//

export type NodeChatboxProps = ChatboxLogicProps &
  Pick<TNodeContext, 'id' | 'close'>;

//

export const NodeChatbox = ({
  id: nodeId,
  close,
  ...props
}: NodeChatboxProps) => {
  // chat node reduce button is special :
  // reduce button actually close the chat node anchor, so the node disapears
  const buttons = useMakeButton({
    isExpanded: true,
    reduce: close,
  });

  return (
    <div className="common-node chat-node">
      <InputsAndOutputs id={nodeId} bottom={false} topDisabled={true} />
      <ChatboxLogic {...props} buttons={buttons} />
    </div>
  );
};
