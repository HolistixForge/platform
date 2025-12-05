import { Whiteboard } from '@holistix-forge/whiteboard/frontend';

import './node-editor.scss';
import { useProject } from '../../project-context';

/**
 *
 */
export const NodeEditorView = ({ viewId }: { viewId: string }) => {
  //

  const project = useProject();

  return (
    <div style={{ height: '100%', backgroundColor: 'var(--color-background)' }}>
      <Whiteboard viewId={viewId} projectId={project.project.project_id} />
    </div>
  );
};
