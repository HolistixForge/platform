import { PageFrame } from '../../page-frame';
import { ProjectSidebar } from '../sidebar';
import { ResourcePage } from '../editor/resources-page';

//

/**
 * The project's resources, as a page of its own.
 *
 * It was a tab, created for every project at initialization and undeletable
 * because the reducer put it back. That made it look like one board among the
 * boards while being nothing of the kind — no view, no nodes, nothing
 * collaborative — and it spent a slot in everyone's tab bar for a page opened
 * occasionally.
 *
 * The rail is a bar here, not an island: this page has content laid out in a
 * grid, and content wants a column beside the rail rather than under it.
 */
export const ProjectResourcesPage = () => (
  <PageFrame
    rail="dashboard"
    sidebar={(variant) => (
      <ProjectSidebar active="resources" variant={variant} />
    )}
  >
    <ResourcePage />
  </PageFrame>
);
