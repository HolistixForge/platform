import { HolistixSpace } from '@monorepo/space/frontend';
import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';

import { modules } from '../../model/modules';

import './node-editor.scss';

//

const nodeTypes = modules.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

const spaceMenuEntries: TSpaceMenuEntries = (args) => {
  return modules.reduce((acc, module) => {
    return [...acc, ...module.spaceMenuEntries(args)];
  }, [] as TSpaceMenuEntry[]);
};

/**
 *
 */
export const NodeEditorView = ({ viewId }: { viewId: string }) => {
  //

  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-background)' }}>
      <HolistixSpace
        viewId={viewId}
        nodeTypes={nodeTypes}
        spaceMenuEntries={spaceMenuEntries}
      />
    </div>
  );
};
