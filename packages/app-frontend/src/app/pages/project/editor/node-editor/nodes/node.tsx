import { useNodeContext } from '@monorepo/space';
import factory from '@monorepo/lazy-factory';

import { useSharedData } from '../../../model/collab-model-chunk';
import { VideoNodeLogic } from './video';
import { ServerNodeLogic } from './server';
import { VolumeNodeLogic } from './volume';
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

export const NodeContent = () => {
  //
  const { id } = useNodeContext();
  const node = useSharedData(['nodes'], (sd) => sd.nodes.get(id));

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
