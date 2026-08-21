/**
 * Organization Configuration
 *
 * Received from Ganymede when gateway starts.
 * Contains all info needed to initialize the gateway for an organization.
 */

export interface TOrganizationMember {
  user_id: string;
  username: string;
  role: 'owner' | 'admin' | 'member';
}

export interface TOrganizationConfig {
  organization_id: string;
  organization_name: string;
  gateway_id: string;
  organization_token: string; // TJwtOrganization for organization-bound operations
  ganymede_fqdn: string;

  // Organization members (for permission initialization)
  members: TOrganizationMember[];

  // Projects in this organization
  projects: string[]; // Array of project_ids

  /**
   * Project id to project name.
   *
   * A container's services are published under the project they belong to, so
   * the gateway needs the name and not only the id. Optional because a
   * Ganymede older than this one does not send it — and a service named
   * without its project is exactly what services were called before, so the
   * absent case degrades to the previous behaviour rather than to a broken
   * one.
   */
  project_names?: Record<string, string>;
}
