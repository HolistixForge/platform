import { Handler } from '../Handler';
import { Executor } from '../../Executor/Executor';
import { ApiDefinition } from '../../ApiDefinition/ApiDefinition';
import { Request } from '../../Request/Request';
import { Response } from '../../Response/Response';

export class AwsHandler extends Handler {
  constructor(e: Executor, d: ApiDefinition) {
    super(e, d);
  }

  start(): void {
    //
  }

  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  async _processAwsRequest(event: any, _context: any): Promise<Response> {
    const r = new Request({
      httpMethod: event.httpMethod,
      json: JSON.parse(event.body),
      pathParameters: event.pathParameters,
      getParameters: event.queryStringParameters,
      headers: event.headers,
      path: event.requestContext.resourcePath,
    });

    await this._executor.doRequest(r);

    if (r.response._cookies.length > 0) throw new Error('Not Implemented');
    if (r.response._redirection) throw new Error('Not Implemented');

    return r.response;
  }
}
