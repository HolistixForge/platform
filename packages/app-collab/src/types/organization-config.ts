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
  gateway_token: string; // For authenticating with Ganymede
  ganymede_fqdn: string;
  
  // Organization members (for permission initialization)
  members: TOrganizationMember[];
  
  // Projects in this organization
  projects: string[]; // Array of project_ids
}

