import { HolistixSpace } from '@monorepo/space/frontend';

import { ContextMenuLogic } from './menus/context-menu-logic';
import { SpaceContextMenu } from './menus/context-menu';
import { NewEdgeContextMenu } from './menus/context-menu-new-edge';
import { modules } from '../../model/modules';

import './node-editor.scss';

//

const nodeTypes = modules.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

/**
 *
 */
export const NodeEditorView = ({ viewId }: { viewId: string }) => {
  //

  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-background)' }}>
      <HolistixSpace viewId={viewId} nodeTypes={nodeTypes} />
    </div>
  );
};
