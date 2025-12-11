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
  domain: string;
  children: ReactNode;
};

//

const fqdn = (host: string | null, domain: string): string => {
  // Domain is already the full domain name (e.g., "domain.local")
  // It should NOT be prefixed with environment name
  // The env parameter is only used to determine if it's production, not for FQDN construction
  if (host === null) {
    return domain;
  } else {
    return `${host}.${domain}`;
  }
};

export const ApiContext = ({ domain, children }: ApiContextProps) => {
  const v: TApiContext = useMemo(() => {
    const frontendFQDN = fqdn(null, domain);
    const ganymedeFQDN = fqdn('ganymede', domain);

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
  }, [domain]);

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
