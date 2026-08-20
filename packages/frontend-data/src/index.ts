// API Layer
export { ApiContext, useApi } from './lib/api-context';
export { GanymedeApi } from './lib/api-ganymede';

// React Query Hooks
export {
  useQueryScope,
  useQueryOrganizationGateway,
  useQueryOrganization,
  useQueryUsersSearch,
  useQueryUser,
  useQueriesUsers,
  useMutationUserScope,
  useCollaborators,
  useQueryUserOrganizations,
  useQueryUserProjects,
  useCurrentUser,
  useMutationLogout,
  useMutationSignup,
  useMutationLogin,
  useMutationTotpSetup,
  useMutationTotpLogin,
  useMutationChangePassword,
  useMutationNewOrganization,
  useMutationNewProject,
  useMutationDeleteProject,
  useQueryProjectByName,
  useMutationStartOrganization,
  // RBAC hooks
  useQueryRoles,
  useQueryRole,
  useQueryUserRoles,
  useQueryOrgMembers,
  useQueryPermissions,
  useMutationCreateRole,
  useMutationUpdateRole,
  useMutationDeleteRole,
  useMutationAssignRole,
  useMutationRemoveRole,
  useMutationAddProjectMember,
  useMutationRemoveProjectMember,
} from './lib/queries';

// RBAC Types
export type {
  Role,
  CreateRoleInput,
  UserRoleAssignment,
  OrgMember,
  PermissionDefinition,
} from './lib/queries';

// Form Data Types
export type {
  LoginFormData,
  NewPasswordFormData,
  NewOrganizationFormData,
  NewProjectFormData,
  SignupFormData,
  TotpLoginFormData,
  TotpEnableFormData,
} from './lib/form-data';

// Data Contexts
export {
  OrganizationProvider,
  useOrganization,
  type OrganizationData,
} from './lib/contexts/organization-context';

// Credentials Wallet
export {
  credentialKeys,
  useQueryCredentialTypes,
  useMutationRegisterCredentialType,
  useQueryCredentials,
  useQueryCredential,
  useMutationCreateCredential,
  useMutationUpdateCredential,
  useMutationDeleteCredential,
  useMutationValidateCredential,
  useQueryCredentialShares,
  useMutationShareCredential,
  useMutationRevokeCredentialShare,
} from './lib/credentials-queries';

export {
  useQueryMachines,
  describeMachines,
  machineKeys,
  MACHINE_STALE_AFTER_MS,
  type TMachine,
  type TMachineUnavailable,
} from './lib/machines-queries';

export {
  ProjectProvider,
  useProject,
  useProjectId,
  type ProjectData,
} from './lib/contexts/project-context';

// Module Infrastructure
export { ModuleDataProvider } from './lib/modules/module-data-provider';
export { createModuleConfigs } from './lib/modules/modules-config';

// Utilities
export { LocalStorageChannel } from './lib/local-storage-channel';
export { LocalStorageStore } from './lib/local-storage-store';
export type { Key } from './lib/local-storage-store';

// Testing Utilities
export { StoryApiContext } from './lib/story-api-context';
export { browserLog } from './lib/browser-log';
