import { ProjectSidebar } from '../sidebar';
import { EditorTabsSystemLogic } from './tabs';

//

export const EditorPage = () => {
  return (
    <div
      style={{
        height: 'calc(100dvh - var(--header-height))',
        overflow: 'hidden',
      }}
    >
      <EditorTabsSystemLogic />
      <ProjectSidebar active="project-main" />
    </div>
  );
};
