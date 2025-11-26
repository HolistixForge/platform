import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { apiContext, TApiContext } from './api-context';
import { useMemo } from 'react';
import { TJson, TMyfetchRequest } from '@monorepo/simple-types';
import { GanymedeApi } from './api-ganymede';
import { browserLog } from './browser-log';

//

class FakeGanymedeApi extends GanymedeApi {
  ganymedeApiMock?: (r: TMyfetchRequest) => Promise<TJson>;

  constructor(
    ganymedeFQDN: string,
    frontendFQDN: string,
    ganymedeApiMock?: (r: TMyfetchRequest) => Promise<TJson>
  ) {
    super(ganymedeFQDN, frontendFQDN);
    this.ganymedeApiMock = ganymedeApiMock;
  }

  override async fetch(r: TMyfetchRequest, host?: string): Promise<TJson> {
    browserLog('debug', 'STORY_API_CONTEXT', 'ganymedeApi: fetch', {
      data: { request: r, host },
    });
    if (this.ganymedeApiMock) {
      return this.ganymedeApiMock(r);
    }
    throw new Error('Not implemented');
  }
}

//

export const StoryApiContext = ({
  children,
  ganymedeApiMock,
}: {
  children: React.ReactNode;
  ganymedeApiMock?: (r: TMyfetchRequest) => Promise<TJson>;
}) => {
  const v: TApiContext = useMemo(() => {
    const ganymedeFQDN = 'https://ganymede-story-mock';
    const frontendFQDN = 'https://frontend-story-mock';
    const ganymedeApi = new FakeGanymedeApi(
      ganymedeFQDN,
      frontendFQDN,
      ganymedeApiMock
    );
    const queryClient = new QueryClient();

    return {
      ganymedeApi,
      ganymedeFQDN,
      queryClient,
    };
  }, [ganymedeApiMock]);

  return (
    <apiContext.Provider value={v}>
      <QueryClientProvider client={v.queryClient}>
        {children}
      </QueryClientProvider>
    </apiContext.Provider>
  );
};
