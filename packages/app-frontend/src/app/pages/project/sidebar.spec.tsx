/**
 * @jest-environment jsdom
 *
 * What the project rail offers, and where each entry goes.
 *
 * Resources moved out of the tab bar and into here. A tab that a reducer
 * recreates whenever it goes missing is not really a tab — it cannot be
 * closed, it sits among the boards while being nothing like one, and it costs
 * every user a slot for a page they open occasionally.
 *
 * The links are relative, which is the part worth pinning: `..` drops the
 * last path segment, so the same entry has to resolve from `/…/editor` and
 * from `/…/resources`. An absolute link would need the org and project ids,
 * which this component does not have.
 */
import { render } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { ProjectSidebar } from './sidebar';

// The rail needs to know which organization owns the project, because access
// control lives at the organization and no number of `..` reaches it from a
// project route.
jest.mock('@holistix-forge/frontend-data', () => ({
  useProject: () => ({ organization_id: 'org-uuid' }),
}));

//

/**
 * The rail inside the route tree it actually lives in.
 *
 * A relative link resolves against the matched *route*, not against the URL,
 * so a bare router would have `..` mean the site root and every assertion
 * here would be about nothing.
 */
const renderRail = (path: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path="/p/:owner/:project_name">
          <Route
            path="editor"
            element={<ProjectSidebar active="project-main" />}
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

describe('the project rail', () => {
  it('offers the board, the resources and the accesses', () => {
    expect(railAt('/p/org-1/proj/editor').map((i) => i.title)).toEqual([
      'project-main',
      'resources',
      'accesses',
    ]);
  });

  it('points each entry at its own page, from the editor', () => {
    expect(railAt('/p/org-1/proj/editor')).toEqual([
      { title: 'project-main', href: '/p/org-1/proj/editor' },
      { title: 'resources', href: '/p/org-1/proj/resources' },
      { title: 'accesses', href: '/org/org-uuid/permissions' },
    ]);
  });

  it('points them at the same places from the resources page', () => {
    // The entry a user is already on has to keep working as a way back to the
    // other one. Resolved from the wrong base, `../resources` would land on
    // `/p/org-1/resources` and 404.
    expect(railAt('/p/org-1/proj/resources')).toEqual([
      { title: 'project-main', href: '/p/org-1/proj/editor' },
      { title: 'resources', href: '/p/org-1/proj/resources' },
      // Absolute, so it is the same from anywhere. A relative one would
      // resolve against the project route and land nowhere.
      { title: 'accesses', href: '/org/org-uuid/permissions' },
    ]);
  });

  it('gives every entry a real icon', () => {
    const { container } = renderRail('/p/org-1/proj/editor');

    expect(container.querySelectorAll('li svg')).toHaveLength(3);
  });
});
