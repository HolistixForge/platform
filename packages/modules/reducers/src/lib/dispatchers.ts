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
