import { HolistixSpace } from '@monorepo/space/frontend';

import './node-editor.scss';

/**
 *
 */
export const NodeEditorView = ({ viewId }: { viewId: string }) => {
  //

  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-background)' }}>
      <HolistixSpace viewId={viewId} />
    </div>
  );
};
