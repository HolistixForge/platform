import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar, SidebarVariant } from '@holistix-forge/ui-base';
import { useProject } from '@holistix-forge/frontend-data';

import { railItems } from '../rail-items';
import { rememberSpace } from '../last-space';

//

/**
 * The rail, inside a space.
 *
 * The same list as everywhere else — the organization's places above the
 * rule, the space's below it — with every entry live, this being the one page
 * where both levels are in reach without help.
 *
 * It is also where the space is remembered, which is what keeps the entries
 * below the rule working from an organization page. The route's own
 * parameters are what gets stored: they are what the URL is rebuilt from, so
 * the memory cannot drift from the routing.
 */
export const ProjectSidebar = ({
  active,
  variant,
}: {
  active: string;
  variant?: SidebarVariant;
}) => {
  const { organization_id } = useProject();
  const { owner, project_name } = useParams<{
    owner: string;
    project_name: string;
  }>();

  useEffect(() => {
    if (owner && project_name)
      rememberSpace({ owner, projectName: project_name });
  }, [owner, project_name]);

  const space =
    owner && project_name ? { owner, projectName: project_name } : undefined;

  return (
    <Sidebar
      active={active}
      variant={variant}
      items={railItems({ organizationId: organization_id, space })}
    />
  );
};
