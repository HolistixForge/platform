import { createContext, useContext, ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { GanymedeApi } from './api-ganymede';

//
//
//

export type TApiContext = {
  ganymedeApi: GanymedeApi;
  ganymedeFQDN: string;
  queryClient: QueryClient;
};

export const apiContext = createContext<TApiContext | null>(null);

//
//
//

type ApiContextProps = {
  env: string;
  domain: string;
  children: ReactNode;
};

//

const fqdn = (
  host: string | null,
  env: string | null,
  domain: string
): string => {
  if (host === null) {
    if (env === null) return domain;
    else return `${env}.${domain}`;
  } else {
    if (env === null) return `${host}.${domain}`;
    else return `${host}.${env}.${domain}`;
  }
};

export const ApiContext = ({ env, domain, children }: ApiContextProps) => {
  const v: TApiContext = useMemo(() => {
    const environment = env === 'production' || env === '' ? null : env;

    const frontendFQDN = fqdn(null, environment, domain);
    const ganymedeFQDN = fqdn('ganymede', environment, domain);

    const queryClient = new QueryClient();

    const ganymedeApi = new GanymedeApi(
      `https://${ganymedeFQDN}`,
      `https://${frontendFQDN}`
    );

    return {
      ganymedeApi,
      ganymedeFQDN,
      queryClient,
    };
  }, [domain, env]);

  return (
    <apiContext.Provider value={v}>
      <QueryClientProvider client={v.queryClient}>
        {children}
      </QueryClientProvider>
    </apiContext.Provider>
  );
};

//
//
//

export const useApi = () => {
  const context = useContext(apiContext);
  return context as TApiContext;
};
