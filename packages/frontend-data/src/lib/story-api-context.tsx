import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiContext, TApiContext } from './api-context';
import { useMemo } from 'react';
import { ApiFetch } from '@monorepo/api-fetch';
import { TJson, TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { GanymedeApi } from './api-ganymede';

//

class FakeApiFetch extends ApiFetch {
  override fetch(
    r: TMyfetchRequest,
    host?: string | undefined
  ): Promise<TJsonObject> {
    console.warn('Story Api Context: accountApi: fetch', r, host);
    throw new Error('Not implemented');
  }
}

//

class FakeGanymedeApi extends GanymedeApi {
  override async fetch(r: TMyfetchRequest, host?: string): Promise<TJson> {
    console.warn('Story Api Context: ganymedeApi: fetch', r, host);
    throw new Error('Not implemented');
  }
}

//

export const StoryApiContext = ({
  children,
}: {
  children: React.ReactNode;
}) => {
  const v: TApiContext = useMemo(() => {
    const accountFQDN = 'http://account-story-mock';
    const ganymedeFQDN = 'https://ganymede-story-mock';
    const frontendFQDN = 'https://frontend-story-mock';
    const accountApi = new FakeApiFetch();
    const ganymedeApi = new FakeGanymedeApi(
      ganymedeFQDN,
      frontendFQDN,
      accountApi
    );
    const queryClient = new QueryClient();

    return {
      ganymedeApi,
      accountApi,
      accountFQDN,
      ganymedeFQDN,
      queryClient,
    };
  }, []);

  return (
    <apiContext.Provider value={v}>
      <QueryClientProvider client={v.queryClient}>
        {children}
      </QueryClientProvider>
    </apiContext.Provider>
  );
};
