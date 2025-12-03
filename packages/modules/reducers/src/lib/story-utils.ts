import { TMyfetchRequest, TJson } from '@holistix/simple-types';
import { ApiFetch } from '@holistix/api-fetch';

import { TBaseEvent, TReducersBackendExports } from '..';
import { TReducersFrontendExports } from '../frontend';

//

class TestFetch extends ApiFetch {
  private processEvent: (event: TBaseEvent) => Promise<void>;

  constructor(processEvent: (event: TBaseEvent) => Promise<void>) {
    super('');
    this.processEvent = processEvent;
  }

  override async fetch(request: TMyfetchRequest): Promise<TJson> {
    // adds a jitter to the dispatch time to simulate a real network propagation delay
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 25)
    );
    await this.processEvent((request.jsonBody as { event: TBaseEvent }).event);
    return {};
  }
}

//

export const linkDispatchToProcessEvent = (
  backendModules: { reducers: TReducersBackendExports },
  frontendModules: { reducers: TReducersFrontendExports }
) => {
  const processEvent = async (event: TBaseEvent) => {
    await (
      backendModules as { reducers: TReducersBackendExports }
    ).reducers.processEvent(event, {
      ip: '127.0.0.1',
      user_id: '123',
      jwt: {},
      headers: {},
    });
  };

  const fetch = new TestFetch(processEvent);

  (
    frontendModules as { reducers: TReducersFrontendExports }
  ).reducers.dispatcher.setFetch(fetch);
};
