/**
 * Credentials Wallet Query Hooks
 *
 * React Query hooks for managing credentials in the frontend.
 * These hooks handle fetching, creating, updating, and deleting credentials.
 */

import {
  TCredentialType,
  TCredentialSummary,
  TCredentialDetail,
  TCredentialShare,
  TCreateCredentialRequest,
  TUpdateCredentialRequest,
  TShareCredentialRequest,
} from '@holistix-forge/types';
import { TJson } from '@holistix-forge/simple-types';
import { useApi } from './api-context';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// =============================================================================
// Query Keys
// =============================================================================

export const credentialKeys = {
  all: ['credentials'] as const,
  lists: () => [...credentialKeys.all, 'list'] as const,
  list: (filters: Record<string, string | boolean | undefined>) =>
    [...credentialKeys.lists(), filters] as const,
  details: () => [...credentialKeys.all, 'detail'] as const,
  detail: (id: string) => [...credentialKeys.details(), id] as const,
  types: () => [...credentialKeys.all, 'types'] as const,
  shares: (credentialId: string) =>
    [...credentialKeys.all, 'shares', credentialId] as const,
};

// =============================================================================
// Credential Types Queries
// =============================================================================

/**
 * Fetch all available credential types
 */
export const useQueryCredentialTypes = () => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: credentialKeys.types(),
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'credentials/types',
        method: 'GET',
      }) as Promise<{ types: TCredentialType[] }>,
    select: (data) => data.types,
    staleTime: 5 * 60 * 1000, // 5 minutes - types don't change often
  });
};

/**
 * Register a new credential type (used by modules)
 */
export const useMutationRegisterCredentialType = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (
      data: Omit<TCredentialType, 'required_fields'> & {
        required_fields?: string[];
      }
    ) =>
      ganymedeApi.fetch({
        url: 'credentials/types',
        method: 'POST',
        jsonBody: data as unknown as TJson,
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.types() });
    },
  });
};

// =============================================================================
// Credentials Queries
// =============================================================================

/**
 * Fetch user's credentials (and optionally shared credentials)
 */
export const useQueryCredentials = (options?: {
  type?: string;
  organization_id?: string;
  project_id?: string;
  resource_id?: string;
  include_shared?: boolean;
}) => {
  const { ganymedeApi } = useApi();

  const queryParams: Record<string, string> = {};
  if (options?.type) queryParams.type = options.type;
  if (options?.organization_id)
    queryParams.organization_id = options.organization_id;
  if (options?.project_id) queryParams.project_id = options.project_id;
  if (options?.resource_id) queryParams.resource_id = options.resource_id;
  if (options?.include_shared) queryParams.include_shared = 'true';

  return useQuery({
    queryKey: credentialKeys.list(options || {}),
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'credentials',
        method: 'GET',
        queryParameters: queryParams,
      }) as Promise<{ credentials: TCredentialSummary[] }>,
    select: (data) => data.credentials,
  });
};

/**
 * Fetch a single credential with decrypted value
 */
export const useQueryCredential = (credentialId: string | null) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: credentialKeys.detail(credentialId || ''),
    queryFn: () =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}`,
        method: 'GET',
        pathParameters: { credential_id: credentialId! },
      }) as Promise<{ credential: TCredentialDetail }>,
    select: (data) => data.credential,
    enabled: !!credentialId,
  });
};

/**
 * Create a new credential
 */
export const useMutationCreateCredential = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TCreateCredentialRequest) =>
      ganymedeApi.fetch({
        url: 'credentials',
        method: 'POST',
        jsonBody: data as unknown as TJson,
      }) as Promise<{ credential: TCredentialSummary }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.lists() });
    },
  });
};

/**
 * Update a credential
 */
export const useMutationUpdateCredential = (credentialId: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TUpdateCredentialRequest) =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}`,
        method: 'PATCH',
        pathParameters: { credential_id: credentialId },
        jsonBody: data as unknown as TJson,
      }) as Promise<{ success: boolean }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.lists() });
      queryClient.invalidateQueries({
        queryKey: credentialKeys.detail(credentialId),
      });
    },
  });
};

/**
 * Delete a credential (soft delete)
 */
export const useMutationDeleteCredential = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (credentialId: string) =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}`,
        method: 'DELETE',
        pathParameters: { credential_id: credentialId },
      }) as Promise<{ success: boolean }>,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: credentialKeys.lists() });
    },
  });
};

/**
 * Validate a credential
 */
export const useMutationValidateCredential = () => {
  const { ganymedeApi } = useApi();

  return useMutation({
    mutationFn: (credentialId: string) =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}/validate`,
        method: 'POST',
        pathParameters: { credential_id: credentialId },
      }) as Promise<{ valid: boolean; message?: string }>,
  });
};

// =============================================================================
// Credential Sharing Queries
// =============================================================================

/**
 * Get shares for a credential
 */
export const useQueryCredentialShares = (credentialId: string | null) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: credentialKeys.shares(credentialId || ''),
    queryFn: () =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}/shares`,
        method: 'GET',
        pathParameters: { credential_id: credentialId! },
      }) as Promise<{ shares: TCredentialShare[] }>,
    select: (data) => data.shares,
    enabled: !!credentialId,
  });
};

/**
 * Share a credential
 */
export const useMutationShareCredential = (credentialId: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: TShareCredentialRequest) =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}/share`,
        method: 'POST',
        pathParameters: { credential_id: credentialId },
        jsonBody: data as unknown as TJson,
      }) as Promise<{ share: TCredentialShare }>,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: credentialKeys.shares(credentialId),
      });
    },
  });
};

/**
 * Revoke a credential share
 */
export const useMutationRevokeCredentialShare = (credentialId: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (shareId: string) =>
      ganymedeApi.fetch({
        url: `credentials/{credential_id}/shares/{share_id}`,
        method: 'DELETE',
        pathParameters: {
          credential_id: credentialId,
          share_id: shareId,
        },
      }) as Promise<{ success: boolean }>,
    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: credentialKeys.shares(credentialId),
      });
    },
  });
};
