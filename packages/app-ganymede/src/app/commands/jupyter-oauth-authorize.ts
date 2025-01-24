import { Command, TCommandReturn } from '@monorepo/backend-engine';

export class JupyterOauthAuthorize extends Command {
  run(a: {
    base_url: string;
    redirect_uri: string;
    code: string;
    state: string;
  }): Promise<TCommandReturn> {
    //

    const redirect = `${a.base_url}${a.redirect_uri}`;

    return Promise.resolve({
      redirect: {
        url: redirect,
        queryParameters: {
          code: a.code,
          state: a.state,
        },
      },
    });
  }
}
