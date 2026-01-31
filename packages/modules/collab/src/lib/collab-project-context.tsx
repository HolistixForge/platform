import { createContext, useContext, ReactNode } from 'react';

/**
 * Context for providing the current project ID to collaboration hooks.
 *
 * This is a lightweight context that ONLY provides project_id for collab hooks.
 * It's separate from ProjectContext (in frontend-data) which provides full project data.
 *
 * @example
 * ```tsx
 * <CollabProjectProvider project_id="my-project">
 *   <YourComponent />
 * </CollabProjectProvider>
 * ```
 */
export const CollabProjectContext = createContext<string | null>(null);

export interface CollabProjectProviderProps {
  project_id: string;
  children: ReactNode;
}

/**
 * Provider for CollabProjectContext.
 *
 * Wrap your components with this provider to enable collab hooks
 * (useLocalSharedData, useAwareness, etc.) to access the current project ID.
 *
 * @param project_id - The current project ID
 * @param children - Child components
 */
export const CollabProjectProvider = ({
  project_id,
  children,
}: CollabProjectProviderProps) => {
  return (
    <CollabProjectContext.Provider value={project_id}>
      {children}
    </CollabProjectContext.Provider>
  );
};

/**
 * Hook to get the current project ID from CollabProjectContext.
 *
 * @throws Error if used outside CollabProjectProvider
 * @returns The current project ID
 */
export const useCollabProjectId = (): string => {
  const project_id = useContext(CollabProjectContext);
  if (project_id === null) {
    throw new Error(
      'useCollabProjectId must be used within CollabProjectProvider. ' +
        'Wrap your component tree with <CollabProjectProvider project_id={...}>.'
    );
  }
  return project_id;
};
