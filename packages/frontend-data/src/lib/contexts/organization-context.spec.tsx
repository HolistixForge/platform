import { renderHook } from '@testing-library/react';
import {
  OrganizationProvider,
  useOrganization,
} from './organization-context';

describe('OrganizationContext', () => {
  describe('useOrganization', () => {
    it('should provide organization_id when wrapped with OrganizationProvider', () => {
      const { result } = renderHook(() => useOrganization(), {
        wrapper: ({ children }) => (
          <OrganizationProvider organization_id="org-123">
            {children}
          </OrganizationProvider>
        ),
      });

      expect(result.current.organization_id).toBe('org-123');
    });

    it('should throw error when used outside OrganizationProvider', () => {
      // Suppress console.error for this test
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();

      expect(() => {
        renderHook(() => useOrganization());
      }).toThrow('useOrganization must be used within OrganizationProvider');

      consoleSpy.mockRestore();
    });
  });
});
