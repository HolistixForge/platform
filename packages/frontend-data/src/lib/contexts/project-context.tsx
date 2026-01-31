import { createContext, useContext, ReactNode } from 'react';
import type { TApi_Project } from '@holistix-forge/types';

/**
 * ProjectContext - Provides project data to components
 * 
 * This is a lightweight data context that provides:
 * - project_id (for collab module hooks and other data access)
 * - project metadata (for UI display)
 * - organization_id (parent organization)
 * - isOwner flag (for permission checks)
 * 
 * UI concerns (loading states, error handling, routing) are handled by app-frontend.
 * 
 * @example
 * ```tsx
 * <ProjectProvider
 *   project={projectData}
 *   organization_id="org-123"
 *   isOwner={true}
 * >
 *   <YourComponent />
 * </ProjectProvider>
 * ```
 */
export type ProjectData = {
  project: TApi_Project;
  organization_id: string;
  isOwner: boolean;
};

const ProjectContext = createContext<ProjectData | null>(null);

/**
 * ProjectProvider - Provides project context to children
 */
export const ProjectProvider = ({
  project,
  organization_id,
  isOwner,
  children,
}: ProjectData & { children: ReactNode }) => {
  return (
    <ProjectContext.Provider value={{ project, organization_id, isOwner }}>
      {children}
    </ProjectContext.Provider>
  );
};

/**
 * useProject - Access project context
 * 
 * @throws Error if used outside ProjectProvider
 * 
 * @example
 * ```tsx
 * const { project, organization_id, isOwner } = useProject();
 * console.log(project.project_name);
 * ```
 */
export const useProject = (): ProjectData => {
  const context = useContext(ProjectContext);
  if (!context) {
    throw new Error(
      'useProject must be used within ProjectProvider. ' +
      'Make sure your component is wrapped with <ProjectProvider>.'
    );
  }
  return context;
};

/**
 * useProjectId - Convenience hook for getting just the project_id
 * 
 * This is heavily used by collab module hooks and other data access hooks
 * that need to know which project they're operating on.
 * 
 * @throws Error if used outside ProjectProvider
 * 
 * @example
 * ```tsx
 * const project_id = useProjectId();
 * const tabs = useLocalSharedData(['tabs:tabs'], d => d['tabs:tabs'].get(project_id));
 * ```
 */
export const useProjectId = (): string => {
  const { project } = useProject();
  return project.project_id;
};
