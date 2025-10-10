import { ApiFetch } from '@monorepo/api-fetch';
import { TJson } from '@monorepo/simple-types';
import { TBaseEvent } from '..';
import { log } from '@monorepo/log';

//

export class FrontendDispatcher<TE extends TBaseEvent> {
  _fetch: ApiFetch | undefined;

  setFetch(fetch: ApiFetch) {
    this._fetch = fetch;
  }

  async dispatch(event: TE): Promise<void> {
    if (!this._fetch) {
      log(3, 'DISPATCH_BROWSER', 'No fetch set', event);
      return;
    }
    log(7, 'DISPATCH_BROWSER', '', event);
    await this._fetch.fetch({
      url: 'event',
      method: 'POST',
      jsonBody: { event: event as TJson },
    });
  }
}

//

/**
 * A dispatcher that adds a jitter to the dispatch time
 * to simulate a real network propagation
 */
export class JitterDispatcher<
  TE extends TBaseEvent
> extends FrontendDispatcher<TE> {
  override async dispatch(event: TE): Promise<void> {
    await new Promise((resolve) =>
      setTimeout(resolve, Math.random() * 200 + 25)
    );
    await super.dispatch(event);
  }
}
