import { useNode } from '@monorepo/demiurge-space';
import { useSharedData } from '../../../model/collab-model-chunk';
import factory from '@monorepo/lazy-factory';
import { JupyterlabCodeCellNodeLogic } from './jupyterlab-code-cell';
import { VideoNodeLogic } from './video';
import { TerminalNodeLogic } from './terminal';
import { ServerNodeLogic } from './server';
import { VolumeNodeLogic } from './volume';
import { NodeDefault } from '@monorepo/demiurge-ui-components';
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
  const useNodeValue = useNode();
  return <NodeDefault {...useNodeValue} {...props} />;
};

//
//

export const NodeContent = () => {
  //
  const { id } = useNode();
  const nodeData = useSharedData(['nodeData'], (sd) => sd.nodeData.get(id));

  if (!nodeData) {
    return <DefaultNodeLogic />;
  }

  switch (nodeData.type) {
    case 'python':
      return <JupyterlabCodeCellNodeLogic {...nodeData} />;
    case 'video':
      return <VideoNodeLogic {...nodeData} />;
    case 'terminal':
      return <TerminalNodeLogic {...nodeData} />;
    case 'server':
      return <ServerNodeLogic {...nodeData} />;
    case 'kernel':
      return <KernelNodeLogic {...nodeData} />;
    case 'volume':
      return <VolumeNodeLogic {...nodeData} />;
    case 'chat':
      return <ChatNodeLogic {...nodeData} />;
    case 'chat-anchor':
      return <ChatAnchorNodeLogic {...nodeData} />;
    default:
      return <DefaultNodeLogic {...nodeData} />;
  }
};
