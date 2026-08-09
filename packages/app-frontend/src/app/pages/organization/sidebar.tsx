import { useParams } from 'react-router-dom';
import { Sidebar, SidebarVariant } from '@holistix-forge/ui-base';

import { railItems } from '../rail-items';
import { lastSpace } from '../last-space';

//

/**
 * The rail, outside a space: on an organization's pages, and on the list of
 * organizations.
 *
 * The same list, in the same order, at the same positions. What changes is
 * only what is in reach — and less than one might expect, because the space
 * below the rule is the last one anyone opened rather than nothing at all. A
 * rail that went half-dead the moment you left a project would be dead
 * exactly where someone is most likely to want to go back to work.
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

  return (
    <Sidebar
      active={active}
      variant={variant}
      items={railItems({ organizationId: organization_id, space: lastSpace() })}
    />
  );
};
