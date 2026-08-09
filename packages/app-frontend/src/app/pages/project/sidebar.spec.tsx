/**
 * @jest-environment jsdom
 *
 * The rail inside a space.
 *
 * Every entry is live here, this being the one page where both levels — the
 * organization's places and the space's — are in reach without help. What
 * this pins is the other half: that entering a space *records* it, because
 * that recording is the only reason the entries below the rule still work
 * from an organization page.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProjectSidebar } from './sidebar';
import { lastSpace, lastOrganization } from '../last-visited';

jest.mock('@holistix-forge/frontend-data', () => ({
  useProject: () => ({ organization_id: 'org-uuid' }),
}));

//

const renderRail = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:owner/:project_name">
          <Route
            path="editor"
            element={<ProjectSidebar active="whiteboard" />}
          />
          <Route
            path="resources"
            element={<ProjectSidebar active="resources" />}
          />
        </Route>
      </Routes>
    </MemoryRouter>
  );

const railAt = (path: string) => {
  const { container } = renderRail(path);
  // `Array.from` rather than a spread: this package's lib target does not
  // give NodeList an iterator, so the spread is a type error even though it
  // runs.
  return Array.from(container.querySelectorAll('li')).map((li) => ({
    title: li.getAttribute('title'),
    href: li.querySelector('a')?.getAttribute('href'),
  }));
};

//

describe('the rail inside a space', () => {
  beforeEach(() => localStorage.clear());

  it('offers both levels, all of it live', () => {
    expect(railAt('/p/org-1/proj/editor')).toEqual([
      { title: 'organizations', href: '/' },
      { title: 'organization', href: '/org/org-uuid' },
      { title: 'accesses', href: '/org/org-uuid/permissions' },
      { title: 'whiteboard', href: '/p/org-1/proj/editor' },
      { title: 'resources', href: '/p/org-1/proj/resources' },
    ]);
  });

  it('says the same thing from the resources page', () => {
    // Absolute links, so the rail means one thing wherever it is rendered.
    // Relative ones resolve against the matched route, which differs by page.
    expect(railAt('/p/org-1/proj/resources')).toEqual([
      { title: 'organizations', href: '/' },
      { title: 'organization', href: '/org/org-uuid' },
      { title: 'accesses', href: '/org/org-uuid/permissions' },
      { title: 'whiteboard', href: '/p/org-1/proj/editor' },
      { title: 'resources', href: '/p/org-1/proj/resources' },
    ]);
  });

  it('separates the space from the organization', () => {
    const { container } = renderRail('/p/org-1/proj/editor');
    const rule = container.querySelector('li.sidebar-group-start');

    expect(rule?.getAttribute('title')).toBe('whiteboard');
  });

  it('greys nothing out', () => {
    const { container } = renderRail('/p/org-1/proj/editor');

    expect(container.querySelectorAll('li.sidebar-item-disabled')).toHaveLength(
      0
    );
  });

  it('records the space it is in, from the route', () => {
    // What is stored is what worked as a URL — the route's own parameters —
    // so rebuilding it elsewhere cannot drift from the routing.
    renderRail('/p/org-1/proj/editor');

    expect(lastSpace()).toEqual({ owner: 'org-1', projectName: 'proj' });
  });

  it('records the organization too, entering a space being entering one', () => {
    // Otherwise the list of organizations would have nothing to point back
    // to for anyone who went straight from it into a project.
    renderRail('/p/org-1/proj/editor');

    expect(lastOrganization()).toBe('org-uuid');
  });
});
