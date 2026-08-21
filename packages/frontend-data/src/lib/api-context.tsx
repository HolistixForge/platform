import { createContext, useContext, ReactNode, useMemo } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { PUBLIC_GANYMEDE_PATH, isConfiguredHost } from '@holistix-forge/types';
import { GanymedeApi } from './api-ganymede';

//
//
//

export type TApiContext = {
  ganymedeApi: GanymedeApi;
  /**
   * Ganymede's base URL, scheme and all. Prefer this over `ganymedeFQDN` for
   * anything that builds a link: through a tunnel there is no separate
   * hostname for Ganymede and this carries a path prefix instead, which
   * `https://${ganymedeFQDN}` cannot express.
   */
  ganymedeUrl: string;
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

/**
 * Where this bundle should look for the frontend and for Ganymede.
 *
 * `domain` is baked in at build time from VITE_DOMAIN_NAME, and until now it
 * was the only answer: the bundle always called `https://ganymede.<domain>`
 * whatever page it was loaded from. That is exactly what breaks the moment the
 * same build is served through a tunnel — the browser is on
 * `foo.trycloudflare.com`, and `ganymede.apollo.test:8443` is a name it cannot
 * resolve, so every call fails before it leaves the machine.
 *
 * So the built-in domain becomes a *default* rather than the answer. If the
 * page was served from it, nothing changes — same URLs, byte for byte. If it
 * was served from anywhere else, the platform is reachable on that one host
 * and only by path, which is the arrangement `PUBLIC_GANYMEDE_PATH` describes.
 *
 * Deciding it here rather than by configuration is deliberate: a tunnel
 * hostname is minted at tunnel start, so a build could not know it, and asking
 * an operator to rebuild the frontend per tunnel would make the feature
 * useless. The page knows where it was loaded from; that is enough.
 */
export const resolveEndpoints = (
  domain: string,
  location?: { host: string; origin: string }
): { frontendUrl: string; ganymedeUrl: string; ganymedeFQDN: string } => {
  const here =
    location ?? (typeof window !== 'undefined' ? window.location : undefined);

  if (here && !isConfiguredHost(here.host, domain)) {
    return {
      frontendUrl: here.origin,
      ganymedeUrl: `${here.origin}${PUBLIC_GANYMEDE_PATH}`,
      ganymedeFQDN: `${here.host}${PUBLIC_GANYMEDE_PATH}`,
    };
  }

  const ganymedeFQDN = fqdn('ganymede', domain);
  return {
    frontendUrl: `https://${fqdn(null, domain)}`,
    ganymedeUrl: `https://${ganymedeFQDN}`,
    ganymedeFQDN,
  };
};

export const ApiContext = ({ domain, children }: ApiContextProps) => {
  const v: TApiContext = useMemo(() => {
    const { frontendUrl, ganymedeUrl, ganymedeFQDN } = resolveEndpoints(domain);

    const queryClient = new QueryClient();

    const ganymedeApi = new GanymedeApi(ganymedeUrl, frontendUrl);

    return {
      ganymedeApi,
      ganymedeUrl,
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
