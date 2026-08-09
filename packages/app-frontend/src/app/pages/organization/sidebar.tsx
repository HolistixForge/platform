import { useParams } from 'react-router-dom';
import { Sidebar, SidebarVariant, icons } from '@holistix-forge/ui-base';

//

/**
 * The rail outside a project: on an organization's pages, and on the list of
 * organizations.
 *
 * The rail is part of the interface, not a feature of the project pages. A
 * page without one has an empty 56px column down its left edge, which reads
 * as chrome that failed to load rather than as a page that has none.
 *
 * What it carries is what is reachable from where you are, and outside a
 * project that is less: there is no board and no resources to point at. With
 * an organization in the route it offers that organization and its accesses;
 * without one — the list of organizations — it offers the list, so the column
 * is never empty and the entry is never a lie.
 *
 * All of it read from the route rather than from a context: none of these
 * pages is inside a project provider, and the hook the project rail uses
 * throws outside one.
 */
export const OrganizationSidebar = ({
  active,
  variant,
}: {
  active: string;
  variant?: SidebarVariant;
}) => {
  const { organization_id } = useParams<{ organization_id: string }>();

  const items = organization_id
    ? [
        {
          title: 'organization',
          Icon: icons.Planet,
          link: `/org/${organization_id}`,
        },
        {
          title: 'accesses',
          Icon: icons.Key,
          link: `/org/${organization_id}/permissions`,
        },
      ]
    : [{ title: 'organizations', Icon: icons.Galaxy, link: '/' }];

  return <Sidebar active={active} variant={variant} items={items} />;
};
