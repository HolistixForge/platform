import { render, screen } from '@testing-library/react';
import '@testing-library/jest-dom';
import { MemoryRouter, Route, Routes } from 'react-router-dom';

import { HeaderLogic } from './header-logic';

/**
 * The permissions key is the only way into the permissions page from the
 * chrome. It was passed by the project header and by nothing else, so it
 * disappeared on the organization dashboard — and on the permissions page
 * itself, which is reached through it.
 *
 * Everything below the link is mocked out: this is about which pages offer the
 * entry, not about the header's rendering.
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
  it('offers the permissions key on an organization page', () => {
    renderAt('/org/org-123', '/org/:organization_id');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      '/org/org-123/permissions'
    );
  });

  it('offers it on the permissions page itself', () => {
    // Reached through the key. Without this the entry vanished exactly where
    // the user had just used it.
    renderAt('/org/org-123/permissions', '/org/:organization_id/permissions');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      '/org/org-123/permissions'
    );
  });

  it('offers nothing where the route names no organization', () => {
    // An account page has no organization to point at. A link built anyway
    // would read `/org/undefined/permissions`.
    renderAt('/account/settings', '/account/settings');

    expect(screen.getByTestId('header')).toHaveAttribute(
      'data-permissions-link',
      ''
    );
  });
});
