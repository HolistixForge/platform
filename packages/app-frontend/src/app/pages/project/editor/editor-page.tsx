import { PageFrame } from '../../page-frame';
import { ProjectSidebar } from '../sidebar';
import { EditorTabsSystemLogic, useActiveTab } from './tabs';

//

export const EditorPage = () => {
  const { payload } = useActiveTab();

  // The whiteboard is a canvas: it has no column to give up, and indenting it
  // would only shrink the board. So the rail floats over it as an island.
  // Every other tab is a page with content, and there the rail is a bar with
  // the content beside it rather than under it.
  const onWhiteboard = payload?.type === 'node-editor';

  return (
    <PageFrame
      rail={onWhiteboard ? 'island' : 'dashboard'}
      sidebar={(variant) => (
        <ProjectSidebar active="project-main" variant={variant} />
      )}
    >
      <EditorTabsSystemLogic />
    </PageFrame>
  );
};
