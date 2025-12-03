import { ApiFetch } from '@holistix/api-fetch';
import { TJson } from '@holistix/simple-types';
import { TBaseEvent } from '..';
import { log, EPriority } from '@holistix/log';

//

export class FrontendDispatcher<TE extends TBaseEvent> {
  _fetch: ApiFetch | undefined;

  setFetch(fetch: ApiFetch) {
    this._fetch = fetch;
  }

  async dispatch(event: TE): Promise<void> {
    if (!this._fetch) {
      log(EPriority.Error, 'DISPATCH_BROWSER', 'No fetch set', event);
      return;
    }
    log(EPriority.Debug, 'DISPATCH_BROWSER', '', event);
    await this._fetch.fetch({
      url: 'event',
      method: 'POST',
      jsonBody: { event: event as TJson },
    });
  }
}
