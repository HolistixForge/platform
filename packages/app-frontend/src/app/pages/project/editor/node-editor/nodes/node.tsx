import { useNodeContext, NodeDefault } from '@monorepo/space';
import factory from '@monorepo/lazy-factory';

import { useSharedData } from '../../../model/collab-model-chunk';
import { JupyterlabCodeCellNodeLogic } from './jupyterlab-code-cell';
import { VideoNodeLogic } from './video';
import { TerminalNodeLogic } from './terminal';
import { ServerNodeLogic } from './server';
import { VolumeNodeLogic } from './volume';
import { KernelNodeLogic } from './kernel';
import { ChatAnchorNodeLogic, ChatNodeLogic } from './chat';

//
//

// TODO: compile error if import path is not calculated,
// does it still lazy load ?
factory.setLibraries({
  socials: () =>
    import(
      /* webpackChunkName: "lazy-factory-lib-social-embeds" */
      `@monorepo/${'social-embeds'}`
    ).then((l) => l.default),
});

//
//

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const DefaultNodeLogic = (props: any) => {
  const useNodeValue = useNodeContext();
  return <NodeDefault {...useNodeValue} {...props} />;
};

//
//

export const NodeContent = () => {
  //
  const { id } = useNodeContext();
  const node = useSharedData(['nodes'], (sd) => sd.nodes.get(id));

  if (!node) {
    return <DefaultNodeLogic />;
  }

  switch (node.type) {
    case 'python':
      return <JupyterlabCodeCellNodeLogic {...node} />;
    case 'video':
      return <VideoNodeLogic {...node} />;
    case 'terminal':
      return <TerminalNodeLogic {...node} />;
    case 'server':
      return <ServerNodeLogic {...node} />;
    case 'kernel':
      return <KernelNodeLogic {...node} />;
    case 'volume':
      return <VolumeNodeLogic {...node} />;
    case 'chat':
      return <ChatNodeLogic {...node} />;
    case 'chat-anchor':
      return <ChatAnchorNodeLogic {...node} />;
    default:
      return <DefaultNodeLogic {...node} />;
  }
};
