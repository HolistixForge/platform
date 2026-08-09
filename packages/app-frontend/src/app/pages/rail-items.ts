import { icons } from '@holistix-forge/ui-base';

import type { TSpace } from './last-visited';

//

/**
 * Everything the rail offers, in one list, on every page.
 *
 * Two levels, separated by a rule: the organization's places, then a space's.
 * The whole list is rendered everywhere — an entry out of reach is greyed,
 * not dropped. Dropping it would change the rail's length by page, so the
 * thing under a given position would move, and someone navigating by muscle
 * memory would click the wrong one.
 *
 * There is usually a space to point at even off a project, because the last
 * one is remembered. Grey is therefore the first-visit case and little else:
 * a user who has never opened a project has nothing to go back to, and saying
 * so is more honest than a link that lands on `/p/undefined`.
 *
 * The space links are absolute rather than relative. `..` resolves against
 * the matched route, so a relative one would mean different things on a
 * project page and on an organization page — and the point of remembering a
 * space is that it means the same thing from everywhere.
 */
export const railItems = ({
  organizationId,
  space,
}: {
  organizationId?: string;
  space?: TSpace;
}) => {
  const spaceUrl = (page: string) =>
    space ? `/p/${space.owner}/${space.projectName}/${page}` : undefined;

  return [
    { title: 'organizations', Icon: icons.Galaxy, link: '/' },
    {
      title: 'organization',
      Icon: icons.Planet,
      link: organizationId ? `/org/${organizationId}` : undefined,
      disabled: !organizationId,
      label: organizationId ? 'organization' : 'organization — pick one first',
    },
    {
      title: 'accesses',
      Icon: icons.Key,
      link: organizationId ? `/org/${organizationId}/permissions` : undefined,
      disabled: !organizationId,
      label: organizationId
        ? 'accesses'
        : 'accesses — pick an organization first',
    },
    {
      title: 'whiteboard',
      Icon: icons.NodeMother,
      link: spaceUrl('editor'),
      disabled: !space,
      separatorBefore: true,
      label: space ? 'whiteboard' : 'whiteboard — open a project first',
    },
    {
      title: 'resources',
      Icon: icons.EnterResource,
      link: spaceUrl('resources'),
      disabled: !space,
      label: space ? 'resources' : 'resources — open a project first',
    },
  ];
};
