import { ProjectPageFrame } from '../project-page-frame';
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
    <ProjectPageFrame
      rail={onWhiteboard ? 'island' : 'dashboard'}
      active="project-main"
    >
      <EditorTabsSystemLogic />
    </ProjectPageFrame>
  );
};
