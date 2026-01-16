import { ApiFetch } from '@holistix-forge/api-fetch';
import { TJson } from '@holistix-forge/simple-types';
import { TBaseEvent } from '..';
import { log, EPriority } from '@holistix-forge/log';

//

export class FrontendDispatcher<TE extends TBaseEvent> {
  _fetch: ApiFetch | undefined;
  _project_id: string | undefined;

  setFetch(fetch: ApiFetch) {
    this._fetch = fetch;
  }

  setProjectId(project_id: string) {
    this._project_id = project_id;
  }

  async dispatch(event: TE): Promise<void> {
    if (!this._fetch) {
      log(EPriority.Error, 'DISPATCH_BROWSER', 'No fetch set', event);
      return;
    }
    if (!this._project_id) {
      log(EPriority.Error, 'DISPATCH_BROWSER', 'No project_id set', event);
      return;
    }
    log(EPriority.Debug, 'DISPATCH_BROWSER', '', event);
    await this._fetch.fetch({
      url: 'event',
      method: 'POST',
      jsonBody: {
        event: event as TJson,
        project_id: this._project_id,
      },
    });
  }
}
