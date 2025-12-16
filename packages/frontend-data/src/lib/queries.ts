import {
  TApi_Project,
  CurrentUserDetails,
  TCollaborator,
  TG_User,
} from '@holistix-forge/types';
import { useApi } from './api-context';
import {
  useQuery,
  useQueries,
  useQueryClient,
  useMutation,
  QueryClient,
} from '@tanstack/react-query';
import {
  LoginFormData,
  NewPasswordFormData,
  NewProjectFormData,
  SignupFormData,
  TotpEnableFormData,
  TotpLoginFormData,
} from './form-data';
import { GanymedeApi } from './api-ganymede';

//
//

export const useQueryOrganizationGateway = (organization_id: string) => {
  const { ganymedeApi } = useApi();
  return useQuery({
    queryKey: ['organization-gateway', organization_id],
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'orgs/{organization_id}/gateway',
        method: 'GET',
        pathParameters: { organization_id },
      }) as Promise<{
        gateway_hostname: string | null;
      }>,
    enabled: !!organization_id,
    // Poll every 30 seconds to detect gateway deallocation
    // Gateway can deallocate itself when idle, so we need to check periodically
    refetchInterval: (query) => {
      // Only poll if gateway was previously available (to detect deallocation)
      // If gateway is null, we can poll less frequently (every 2 minutes)
      const data = query.state.data;
      if (data?.gateway_hostname) {
        return 30000; // 30 seconds when gateway is active
      } else {
        return 120000; // 2 minutes when gateway is not available
      }
    },
    // Continue polling even when window is not focused
    refetchIntervalInBackground: true,
  });
};

export const useQueryOrganization = (organization_id: string) => {
  const { ganymedeApi } = useApi();
  return useQuery<{
    organization_id: string;
    owner_user_id: string;
    name: string;
    created_at: string;
  }>({
    queryKey: ['organization', organization_id],
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'orgs/{organization_id}',
        method: 'GET',
        pathParameters: { organization_id },
      }) as Promise<{
        organization_id: string;
        owner_user_id: string;
        name: string;
        created_at: string;
      }>,
    enabled: !!organization_id,
  });
};

export const useQueryScope = (organization_id: string) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['scope', organization_id],
    queryFn: () =>
      ganymedeApi.fetchGateway(
        {
          url: `permissions`,
          method: 'GET',
        },
        organization_id
      ) as Promise<{
        permissions: Array<{
          permission: string;
          module: string;
          resourcePath: string;
          action: string;
          description?: string;
        }>;
      }>,
    enabled: !!ganymedeApi.getGatewayHostname(organization_id),
    select: (data) => data.permissions.map((p) => p.permission),
  });
};

//

export const useQueryUser = (user_id: string | null) => {
  const { ganymedeApi } = useApi();

  return useQuery<TG_User>({
    queryKey: ['user', user_id],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `users/{user_id}`,
        method: 'GET',
        pathParameters: { user_id: user_id as string },
      }) as Promise<TG_User>,
    enabled: !!user_id,
  });
};

export const useQueriesUsers = (ids: string[]) => {
  const { ganymedeApi } = useApi();

  const queries = ids.map((user_id) => ({
    queryKey: ['user', user_id],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `users/{user_id}`,
        method: 'GET',
        pathParameters: { user_id },
      }) as Promise<TG_User>,
  }));

  return useQueries({ queries });
};

//

export const useQueryUsersSearch = (token: string) => {
  const { ganymedeApi } = useApi();

  return useQuery<TG_User[]>({
    queryKey: ['search-users', token],
    queryFn: () =>
      token
        ? (
            ganymedeApi.fetch({
              url: `users/search`,
              method: 'GET',
              queryParameters: { query: token },
            }) as Promise<{
              users: TG_User[];
            }>
          ).then((o) => o.users)
        : [],
  });
};

//

export const useQueryProjectUsersScopes = (
  organization_id: string | null,
  project_id: string
) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['authorizations', organization_id, project_id],
    queryFn: () =>
      ganymedeApi.fetchGateway(
        {
          url: `permissions/projects/{project_id}`,
          method: 'GET',
          pathParameters: {
            project_id,
          },
        },
        organization_id!,
        project_id
      ) as Promise<{
        permissions: { [user_id: string]: string[] };
      }>,
    enabled:
      !!organization_id &&
      !!project_id &&
      !!ganymedeApi.getGatewayHostname(organization_id),
  });
};

//

export const useCollaborators = (
  organization_id: string | null,
  project_id: string
) => {
  const { ganymedeApi } = useApi();

  // Get project members from Ganymede
  const membersQuery = useQuery({
    queryKey: ['project-members', project_id],
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'projects/{project_id}/members',
        method: 'GET',
        pathParameters: { project_id },
      }) as Promise<{
        members: Array<{
          user_id: string;
          username: string;
          email: string;
          added_at: string;
        }>;
      }>,
    enabled: !!project_id,
  });

  // Get permissions from Gateway
  const permissionsQuery = useQueryProjectUsersScopes(
    organization_id,
    project_id
  );

  // Get user details for all members
  const users_ids =
    membersQuery.status === 'success' && membersQuery.data
      ? membersQuery.data.members.map((m) => m.user_id)
      : [];

  const usersQueries = useQueriesUsers(users_ids);

  let collaborators: TCollaborator[] = [];

  // Combine members, user details, and permissions
  if (
    membersQuery.status === 'success' &&
    membersQuery.data &&
    permissionsQuery.status === 'success' &&
    permissionsQuery.data
  ) {
    const permissionsMap = permissionsQuery.data.permissions;

    collaborators = usersQueries
      .filter((uq) => uq.status === 'success')
      .map((uq) => {
        const user = uq.data as TG_User;
        const userPermissions = permissionsMap[user.user_id] || [];
        const c: TCollaborator = {
          ...user,
          scope: userPermissions,
          is_owner: false, // TODO: Determine from organization ownership
        };
        return c;
      });
  }

  const usersLoading = usersQueries.filter((q) => q.status !== 'success');

  const loading =
    membersQuery.status !== 'success' ||
    permissionsQuery.status !== 'success' ||
    usersLoading.length > 0;

  return { collaborators, loading };
};

//

export const useMutationUserScope = (
  organization_id: string | null,
  project_id: string
) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: { user_id: string; scope: string[] }) => {
      const { user_id, scope } = arg;
      return ganymedeApi.fetchGateway(
        {
          url: `permissions/projects/{project_id}/users/{user_id}`,
          method: 'PATCH',
          pathParameters: {
            project_id,
            user_id,
          },
          jsonBody: { permissions: scope },
        },
        organization_id!,
        project_id
      );
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['authorizations', organization_id, project_id],
      });
    },
  });
};

//

export const useCurrentUser = () => {
  const { ganymedeApi } = useApi();
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () =>
      ganymedeApi.fetch({
        method: 'POST',
        url: 'me',
      }) as Promise<{
        user: CurrentUserDetails | { user_id: null };
      }>,
  });
};

//

const invalidateCurrentUser = (qc: QueryClient, ga: GanymedeApi) => {
  qc.invalidateQueries({ queryKey: ['current-user'] });
  ga.reset(); // delete all previous tokens
};

//

export const useMutationLogout = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'logout',
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationSignup = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: SignupFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'signup',
        jsonBody: d,
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationLogin = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: LoginFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'login',
        jsonBody: d,
      });
    },
    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationTotpSetup = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: TotpEnableFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'totp/setup',
        jsonBody: d,
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationTotpLogin = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: TotpLoginFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'totp/login',
        jsonBody: d,
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationChangePassword = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: NewPasswordFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'password',
        jsonBody: d,
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//
//
//
//

export const useQueryUserProjects = () => {
  const { ganymedeApi } = useApi();

  return useQuery<TApi_Project[]>({
    queryKey: ['user-projects', 'me'],
    queryFn: () =>
      (
        ganymedeApi.fetch({
          url: 'projects',
          method: 'GET',
        }) as Promise<{
          projects: TApi_Project[];
        }>
      ).then((data) => data.projects),
  });
};

export const useMutationNewProject = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: NewProjectFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'projects',
        jsonBody: d,
      }) as Promise<{
        project_id: string;
      }>;
    },

    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['user-projects', 'me'] }),
  });
};

export const useMutationDeleteProject = (project_id: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return ganymedeApi.fetch({
        method: 'DELETE',
        url: 'projects/{project_id}',
        pathParameters: {
          project_id,
        },
      });
    },

    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: ['user-projects', 'me'] }),
  });
};

//

export const useQueryProjectByName = (owner: string, project_name: string) => {
  const { ganymedeApi } = useApi();
  return useQuery<TApi_Project>({
    queryKey: ['projects', owner, project_name],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `projects`,
        method: 'GET',
        queryParameters: {
          owner,
          name: project_name,
        },
      }) as Promise<TApi_Project>,
  });
};

export const useMutationStartOrganization = (organization_id: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return ganymedeApi.fetch({
        url: `gateway/start`,
        method: 'POST',
        jsonBody: {
          organization_id,
        },
      }) as Promise<{
        gateway_hostname: string;
      }>;
    },

    onSuccess: (data) => {
      // Invalidate organization gateway query to refresh gateway hostname
      queryClient.invalidateQueries({
        queryKey: ['organization-gateway', organization_id],
      });
      // Also invalidate user projects in case gateway status affects project list
      queryClient.invalidateQueries({ queryKey: ['user-projects', 'me'] });
    },
  });
};
