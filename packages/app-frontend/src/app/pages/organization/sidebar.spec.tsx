/**
 * @jest-environment jsdom
 *
 * The rail on an organization page.
 *
 * It exists because the rail is part of the interface rather than a feature
 * of the project pages. Arriving on permissions from a project used to leave
 * the whole left column empty, which reads as chrome that failed to load
 * rather than as a page that has none.
 *
 * It carries less than a project's rail, and that is not an omission: an
 * organization page is not inside a project, so there is no board and no
 * resources it could point at.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OrganizationSidebar } from './sidebar';

//

const renderRail = (path: string, active = 'accesses') =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/" element={<OrganizationSidebar active={active} />} />
        <Route
          path="/org/:organization_id"
          element={<OrganizationSidebar active={active} />}
        />
        <Route
          path="/org/:organization_id/permissions"
          element={<OrganizationSidebar active={active} />}
        />
      </Routes>
    </MemoryRouter>
  );

const railAt = (path: string) => {
  const { container } = renderRail(path);
  return Array.from(container.querySelectorAll('li')).map((li) => ({
    title: li.getAttribute('title'),
    href: li.querySelector('a')?.getAttribute('href'),
  }));
};

//

describe('the organization rail', () => {
  it('carries the organization and its accesses, taken from the route', () => {
    // From the route rather than a context: none of these pages is inside a
    // project provider, and the one the project rail uses would throw here.
    expect(railAt('/org/org-uuid/permissions')).toEqual([
      { title: 'organization', href: '/org/org-uuid' },
      { title: 'accesses', href: '/org/org-uuid/permissions' },
    ]);
  });

  it('carries the same two on the organization’s own page', () => {
    expect(railAt('/org/org-uuid')).toEqual([
      { title: 'organization', href: '/org/org-uuid' },
      { title: 'accesses', href: '/org/org-uuid/permissions' },
    ]);
  });

  it('offers the list where the route names no organization', () => {
    // Rather than nothing: an empty rail is a 56px stripe down the page that
    // reads as chrome which failed to load. And an accesses entry here would
    // point at `/org/undefined/permissions`.
    expect(railAt('/')).toEqual([{ title: 'organizations', href: '/' }]);
  });

  it('is there at all, which is the whole point', () => {
    const { container } = renderRail('/org/org-uuid/permissions');

    expect(container.querySelector('aside')).toBeTruthy();
    expect(container.querySelectorAll('li svg')).toHaveLength(2);
  });

  it('points at the page it is already on, so the entry can be marked', () => {
    // The rail marks the active entry by matching `active` against the
    // titles. An entry that is never the active one would never be marked.
    const { container } = renderRail('/org/org-uuid/permissions', 'accesses');
    const marked = Array.from(container.querySelectorAll('li')).findIndex(
      (li) => li.querySelector('svg.active')
    );

    expect(marked).toBe(1);
  });
});
