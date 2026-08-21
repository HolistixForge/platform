import { useEffect } from 'react';
import { useParams } from 'react-router-dom';
import { Sidebar, SidebarVariant } from '@holistix-forge/ui-base';

import { railItems } from '../rail-items';
import {
  lastSpace,
  lastOrganization,
  rememberOrganization,
} from '../last-visited';

//

/**
 * The rail, outside a space: on an organization's pages, and on the list of
 * organizations.
 *
 * The same list, in the same order, at the same positions. What changes is
 * only what is in reach — and less than one might expect, because both levels
 * fall back to the last one visited rather than to nothing. A rail that went
 * half-dead the moment you left a project, or that had nothing to say on the
 * list of organizations, would be dead exactly where someone is most likely
 * to want to go back to work.
 *
 * The route wins where it says something, and it is also what gets recorded:
 * arriving on an organization page is how that organization becomes the one
 * the list of organizations points back to.
 *
 * Read from the route rather than from a context: none of these pages is
 * inside a project provider, and the hook the project rail uses throws
 * outside one.
 */
export const OrganizationSidebar = ({
  active,
  variant,
}: {
  active: string;
  variant?: SidebarVariant;
}) => {
  const { organization_id } = useParams<{ organization_id: string }>();

  useEffect(() => {
    if (organization_id) rememberOrganization(organization_id);
  }, [organization_id]);

  return (
    <Sidebar
      active={active}
      variant={variant}
      items={railItems({
        organizationId: organization_id ?? lastOrganization(),
        space: lastSpace(),
      })}
    />
  );
};
