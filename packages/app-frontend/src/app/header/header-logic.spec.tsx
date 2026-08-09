import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { HeaderLogic } from './header-logic';

/**
 * The header offers no way into permissions, anywhere.
 *
 * It used to, and the key moved to the rail — which every page has now,
 * organization pages included. Two doors to the same room on one screen is
 * one more than there should be, and the header is the wrong one: it is
 * identical on every page, so a question about *this* organization's people
 * read there as a global setting.
 *
 * Asserted rather than assumed, because the way this regresses is by someone
 * passing `permissionsLink` again to fix a page that looks bare — and the
 * duplicate is easy to miss, the two entries being far apart on screen.
 */
jest.mock('@holistix-forge/frontend-data', () => ({
  useCurrentUser: () => ({
    data: { user: { user_id: 'u1' } },
    status: 'success',
  }),
  useMutationLogout: () => ({ mutateAsync: jest.fn() }),
  useQueriesUsers: () => [],
  useProject: () => ({ organization_id: 'from-project-context' }),
}));

jest.mock('@holistix-forge/ui-base', () => ({
  useAction: (fn: unknown) => fn,
}));

jest.mock('@holistix-forge/collab/frontend', () => ({
  useAwarenessUserList: () => [],
}));

jest.mock('@holistix-forge/ui-views', () => ({
  Header: ({ permissionsLink }: { permissionsLink?: string }) => (
    <nav data-testid="header" data-permissions-link={permissionsLink ?? ''} />
  ),
}));

const renderAt = (path: string, pattern: string) =>
  render(
    <MemoryRouter initialEntries={[path]}>
      <Routes>
        <Route path={pattern} element={<HeaderLogic />} />
      </Routes>
    </MemoryRouter>
  );

describe('HeaderLogic permissions entry', () => {
  it('offers no permissions key on an organization page', () => {
    renderAt('/org/org-123', '/org/:organization_id');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      ''
    );
  });

  it('offers none on the permissions page itself', () => {
    // Where the rail is showing the entry, marked as the current one.
    renderAt('/org/org-123/permissions', '/org/:organization_id/permissions');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      ''
    );
  });

  it('offers none where the route names no organization', () => {
    renderAt('/account/settings', '/account/settings');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      ''
    );
  });
});
