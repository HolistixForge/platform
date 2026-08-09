/**
 * @jest-environment jsdom
 *
 * The rail outside a space.
 *
 * Same list, same order, same positions as inside one — an entry out of reach
 * is greyed, never dropped. Dropped, the rail would change length by page and
 * the thing under a given position would move, so anyone navigating by muscle
 * memory would click the wrong one.
 *
 * And it is usually not out of reach at all: the last space anyone opened is
 * remembered, so the entries below the rule still work from here. A rail that
 * went half-dead on leaving a project would be dead exactly where someone is
 * most likely to want to go back to work.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { OrganizationSidebar } from './sidebar';
import {
  rememberSpace,
  rememberOrganization,
  lastOrganization,
} from '../last-visited';

//

const renderRail = (path: string, active = 'organization') =>
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
    off: li.classList.contains('sidebar-item-disabled'),
  }));
};

//

describe('the rail outside a space', () => {
  beforeEach(() => localStorage.clear());

  it('keeps the space entries live, pointing at the last one opened', () => {
    rememberSpace({ owner: 'org-1', projectName: 'proj' });

    expect(railAt('/org/org-uuid/permissions')).toEqual([
      { title: 'organizations', href: '/', off: false },
      { title: 'organization', href: '/org/org-uuid', off: false },
      { title: 'accesses', href: '/org/org-uuid/permissions', off: false },
      { title: 'whiteboard', href: '/p/org-1/proj/editor', off: false },
      { title: 'resources', href: '/p/org-1/proj/resources', off: false },
    ]);
  });

  it('greys the space entries for someone who has never opened one', () => {
    // First visit, and the only case left where they are dead. Saying so is
    // more honest than a link that lands on `/p/undefined/undefined/editor`.
    const rail = railAt('/org/org-uuid');

    // The title carries the reason once the entry is out of reach — the
    // tooltip is the only room a 56px column has for one.
    expect(rail.slice(3)).toEqual([
      {
        title: 'whiteboard — open a project first',
        href: undefined,
        off: true,
      },
      { title: 'resources — open a project first', href: undefined, off: true },
    ]);
  });

  it('falls back to the last organization where the route names none', () => {
    // The list of organizations names none, and it is exactly where someone
    // wants to get back to the one they were in.
    rememberOrganization('org-remembered');

    expect(railAt('/').slice(0, 3)).toEqual([
      { title: 'organizations', href: '/', off: false },
      { title: 'organization', href: '/org/org-remembered', off: false },
      {
        title: 'accesses',
        href: '/org/org-remembered/permissions',
        off: false,
      },
    ]);
  });

  it('greys them for someone who has never opened one', () => {
    expect(railAt('/').slice(1, 3)).toEqual([
      { title: 'organization — pick one first', href: undefined, off: true },
      {
        title: 'accesses — pick an organization first',
        href: undefined,
        off: true,
      },
    ]);
  });

  it('lets the route win over the memory', () => {
    // Two organizations open in two tabs would otherwise show each other's.
    rememberOrganization('org-remembered');

    expect(railAt('/org/org-in-route')[1]).toEqual({
      title: 'organization',
      href: '/org/org-in-route',
      off: false,
    });
  });

  it('records the organization it is on', () => {
    renderRail('/org/org-visited');

    expect(lastOrganization()).toBe('org-visited');
  });

  it('is the same length wherever it is rendered', () => {
    // The whole reason entries are greyed rather than dropped.
    expect(railAt('/')).toHaveLength(5);
    expect(railAt('/org/org-uuid')).toHaveLength(5);
    expect(railAt('/org/org-uuid/permissions')).toHaveLength(5);
  });

  it('separates the space from the organization, here too', () => {
    const { container } = renderRail('/org/org-uuid');
    const sizes = Array.from(container.querySelectorAll('ul')).map(
      (ul) => ul.querySelectorAll('li').length
    );

    expect(sizes).toEqual([3, 2]);
  });

  it('says why an entry is out of reach', () => {
    // The tooltip is the only room a 56px column has for a reason.
    const { container } = renderRail('/org/org-uuid');
    const off = Array.from(
      container.querySelectorAll('li.sidebar-item-disabled')
    ).map((li) => li.getAttribute('title'));

    expect(off).toEqual([
      'whiteboard — open a project first',
      'resources — open a project first',
    ]);
  });
});
