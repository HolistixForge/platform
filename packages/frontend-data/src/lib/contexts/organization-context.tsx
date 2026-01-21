import { createContext, useContext, ReactNode } from 'react';

/**
 * OrganizationContext - Provides organization_id to components
 * 
 * This is a lightweight data context that only provides the organization ID.
 * Module loading and UI concerns are handled by ModuleDataProvider in frontend-data
 * and UI components in app-frontend.
 * 
 * @example
 * ```tsx
 * <OrganizationProvider organization_id="org-123">
 *   <YourComponent />
 * </OrganizationProvider>
 * ```
 */
export type OrganizationData = {
  organization_id: string;
};

const OrganizationContext = createContext<OrganizationData | null>(null);

/**
 * OrganizationProvider - Provides organization context to children
 */
export const OrganizationProvider = ({
  organization_id,
  children,
}: {
  organization_id: string;
  children: ReactNode;
}) => {
  return (
    <OrganizationContext.Provider value={{ organization_id }}>
      {children}
    </OrganizationContext.Provider>
  );
};

/**
 * useOrganization - Access organization context
 * 
 * @throws Error if used outside OrganizationProvider
 * 
 * @example
 * ```tsx
 * const { organization_id } = useOrganization();
 * ```
 */
export const useOrganization = (): OrganizationData => {
  const context = useContext(OrganizationContext);
  if (!context) {
    throw new Error(
      'useOrganization must be used within OrganizationProvider. ' +
      'Make sure your component is wrapped with <OrganizationProvider>.'
    );
  }
  return context;
};
