import {
  TCredentialShare,
  TCredentialSummary,
  TCredentialType,
} from '@holistix-forge/types';
import type { Organization, Project } from './CredentialShareDialog';

/**
 * Deterministic fixtures shared by the credentials stories.
 *
 * Everything here is static on purpose: the stories are captured by the
 * visual regression runner, so no `Date.now()`, no random ids.
 */

export const mockCredentialTypes: TCredentialType[] = [
  {
    credential_type: 'openai_api_key',
    display_name: 'OpenAI API Key',
    description: 'API key used by the AI modules',
    icon_url: null,
    validation_schema: null,
    required_fields: ['value'],
    module_name: 'ai',
  },
  {
    credential_type: 'github_token',
    display_name: 'GitHub Token',
    description: 'Personal access token used to clone private repositories',
    icon_url: null,
    validation_schema: null,
    required_fields: ['value'],
    module_name: 'vcs',
  },
  {
    credential_type: 'aws_access_key',
    display_name: 'AWS Access Key',
    description: 'Access key for S3 buckets and EC2 runners',
    icon_url: null,
    validation_schema: null,
    required_fields: ['value'],
    module_name: 'cloud',
  },
  {
    credential_type: 'slack_webhook',
    display_name: 'Slack Webhook',
    description: 'Incoming webhook used for notifications',
    icon_url: null,
    validation_schema: null,
    required_fields: ['value'],
    module_name: 'communication',
  },
  {
    credential_type: 'generic_secret',
    display_name: 'Generic Secret',
    description: null,
    icon_url: null,
    validation_schema: null,
    required_fields: ['value'],
    module_name: 'generic',
  },
];

export const mockCredentials: TCredentialSummary[] = [
  {
    credential_id: 'cred-1',
    user_id: 'user-1',
    credential_type: 'openai_api_key',
    name: 'OpenAI — production',
    metadata: {},
    created_at: '2026-01-08T09:00:00.000Z',
    updated_at: '2026-01-08T09:00:00.000Z',
    last_used_at: '2026-02-14T11:32:00.000Z',
    is_shared: true,
    share_scope: 'organization',
  },
  {
    credential_id: 'cred-2',
    user_id: 'user-1',
    credential_type: 'github_token',
    name: 'GitHub — CI bot',
    metadata: {},
    created_at: '2026-01-09T09:00:00.000Z',
    updated_at: '2026-01-09T09:00:00.000Z',
    last_used_at: null,
    is_shared: false,
    share_scope: null,
  },
  {
    credential_id: 'cred-3',
    user_id: 'user-1',
    credential_type: 'aws_access_key',
    name: 'AWS — staging',
    metadata: {},
    created_at: '2026-01-10T09:00:00.000Z',
    updated_at: '2026-01-10T09:00:00.000Z',
    last_used_at: '2026-01-30T08:05:00.000Z',
    is_shared: false,
    share_scope: null,
  },
];

export const mockOrganizations: Organization[] = [
  { organization_id: 'org-1', name: 'Holistix Forge' },
  { organization_id: 'org-2', name: 'Acme Labs' },
];

export const mockProjects: Project[] = [
  { project_id: 'proj-1', name: 'Data Platform', organization_id: 'org-1' },
  { project_id: 'proj-2', name: 'Website', organization_id: 'org-1' },
  { project_id: 'proj-3', name: 'Research', organization_id: 'org-2' },
];

export const mockShares: TCredentialShare[] = [
  {
    share_id: 'share-1',
    credential_id: 'cred-1',
    share_scope: 'organization',
    organization_id: 'org-1',
    project_id: null,
    resource_id: null,
    granted_by: 'user-1',
    granted_at: '2026-01-15T10:00:00.000Z',
    revoked_at: null,
    is_active: true,
  },
  {
    share_id: 'share-2',
    credential_id: 'cred-1',
    share_scope: 'project',
    organization_id: 'org-1',
    project_id: 'proj-1',
    resource_id: null,
    granted_by: 'user-1',
    granted_at: '2026-01-16T10:00:00.000Z',
    revoked_at: null,
    is_active: true,
  },
];
