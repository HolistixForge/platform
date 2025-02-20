import {
  TApi_Authorization,
  TApi_Project,
  CurrentUserDetails,
  TCollaborator,
  TG_User,
} from '@monorepo/demiurge-types';
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

/** what is returned by Ganyemde API */
export type TG_ServerImage = {
  image_id: number;
  image_name: string;
  image_tag: string;
  image_sha256: string | null;
};

export const useQueryServerImages = () => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['images'],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `images`,
        method: 'GET',
      }) as Promise<{
        _0: TG_ServerImage[];
      }>,
  });
};

//

export const useQueryScope = () => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['scope'],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `scope`,
        method: 'GET',
      }) as Promise<string[]>,
  });
};

//

export const useQueryUser = (user_id: string | null) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['user', user_id],
    queryFn: () =>
      (
        ganymedeApi.fetch({
          url: `users`,
          method: 'GET',
          queryParameters: { user_id: user_id as string },
        }) as Promise<{
          _0: TG_User[];
        }>
      ).then((us) => us._0[0]),
    enabled: !!user_id,
  });
};

export const useQueriesUsers = (ids: string[]) => {
  const { ganymedeApi } = useApi();

  const queries = ids.map((user_id) => ({
    queryKey: ['user', user_id],
    queryFn: () =>
      (
        ganymedeApi.fetch({
          url: `users`,
          method: 'GET',
          queryParameters: { user_id },
        }) as Promise<{
          _0: TG_User[];
        }>
      ).then((us) => us._0[0]),
  }));

  return useQueries({ queries });
};

//

export const useQueryUsersSearch = (token: string) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['search-users', token],
    queryFn: () =>
      token
        ? (
            ganymedeApi.fetch({
              url: `users`,
              method: 'GET',
              queryParameters: { searched: token },
            }) as Promise<{
              _0: TG_User[];
            }>
          ).then((o) => o._0)
        : [],
  });
};

//

export const useQueryProjectUsersScopes = (project_id: string) => {
  const { ganymedeApi } = useApi();

  return useQuery({
    queryKey: ['authorizations', project_id],
    queryFn: () =>
      (
        ganymedeApi.fetch({
          url: `projects/{project_id}/authorizations`,
          method: 'POST',
          pathParameters: {
            project_id,
          },
        }) as Promise<{
          _0: TApi_Authorization[];
        }>
      ).then((o) => o._0),
  });
};

//

export const useCollaborators = (project_id: string) => {
  const authorizations = useQueryProjectUsersScopes(project_id);

  // all users id having any authorizations on the project
  const users_ids =
    authorizations.status === 'success'
      ? authorizations.data.map((a) => a.user_id)
      : [];

  const usersQueries = useQueriesUsers(users_ids);

  let collaborators: TCollaborator[] = [];

  // when we have server users authorizations
  if (authorizations.data) {
    // we build an array of TCollaborator for those info are ready
    collaborators = usersQueries
      .filter((uq) => uq.status === 'success')
      .map((uq) => {
        // we get the authorizations of this user
        // (we known we have it)
        const userAuths = authorizations.data.find(
          (a) => a.user_id === (uq.data as TG_User).user_id
        ) as TApi_Authorization;
        const c: TCollaborator = {
          ...(uq.data as TG_User),
          scope: userAuths.scope,
          is_owner: userAuths.is_owner,
        };

        return c;
      });
  }

  const usersLoading = usersQueries.filter((q) => q.status !== 'success');

  const loading =
    authorizations.status !== 'success' || usersLoading.length > 0;

  return { collaborators, loading };
};

//

export const useMutationUserScope = (project_id: string) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (arg: { user_id: string; scope: string[] }) => {
      const { user_id, scope } = arg;
      return ganymedeApi.fetch({
        url: `projects/{project_id}/authorizations`,
        method: 'PATCH',
        pathParameters: {
          project_id,
        },
        jsonBody: { user_id, scope },
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({
        queryKey: ['authorizations', project_id],
      });
    },
  });
};

//

export const useCurrentUser = () => {
  const { accountApi } = useApi();
  return useQuery({
    queryKey: ['current-user'],
    queryFn: () =>
      accountApi.fetch({
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
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return accountApi.fetch({
        method: 'POST',
        url: 'logout',
      });
    },

    onSuccess: () => invalidateCurrentUser(queryClient, ganymedeApi),
  });
};

//

export const useMutationSignup = () => {
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: SignupFormData) => {
      return accountApi.fetch({
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
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: LoginFormData) => {
      return accountApi.fetch({
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
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: TotpEnableFormData) => {
      return accountApi.fetch({
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
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: TotpLoginFormData) => {
      return accountApi.fetch({
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
  const { accountApi, ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: NewPasswordFormData) => {
      return accountApi.fetch({
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

  return useQuery({
    queryKey: ['user-projects', 'me'],
    queryFn: () =>
      ganymedeApi.fetch({
        url: 'me/projects',
        method: 'GET',
      }) as Promise<{
        _0: Pick<TApi_Project, 'name' | 'owner_id' | 'project_id'>[];
      }>,
  });
};

export const useMutationNewProject = () => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (d: NewProjectFormData) => {
      return ganymedeApi.fetch({
        method: 'POST',
        url: 'projects/new',
        jsonBody: d,
      });
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
  return useQuery({
    queryKey: ['projects', owner, project_name],
    queryFn: () =>
      ganymedeApi.fetch({
        url: `projects`,
        method: 'GET',
        queryParameters: {
          user_id: owner,
          project_name,
        },
      }) as Promise<{ _0: TApi_Project }>,
  });
};

export const useMutationStartProject = (
  project_id: string,
  owner: string,
  project_name: string
) => {
  const { ganymedeApi } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => {
      return ganymedeApi.fetch({
        url: `projects/{project_id}/start`,
        method: 'POST',
        pathParameters: {
          project_id,
        },
      });
    },

    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['user-projects', 'me'] });
      queryClient.invalidateQueries({
        queryKey: ['projects', owner, project_name],
      });
    },
  });
};
