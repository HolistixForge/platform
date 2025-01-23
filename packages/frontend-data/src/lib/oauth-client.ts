import { TJson, TMyfetchRequest } from '@monorepo/simple-types';

export type Tokens = {
  access_token: string;
  refresh_token: string;
  scope: string;
  token_type: string;
  expires_in: number; // secondes
};

export const doOauthCode = async (args: {
  fetch: (r: TMyfetchRequest) => Promise<TJson>;
  redirect_uri: string;
  scope: string;
  client_id: string;
  client_secret: string;
}) => {
  const array = new Uint8Array(50);
  crypto.getRandomValues(array);
  const state = Array.from(array, (byte) => byte.toString(16)).join('');

  const response = (await args.fetch({
    url: `oauth/authorize`,
    method: 'POST',
    queryParameters: {
      redirect_uri: args.redirect_uri,
      client_id: args.client_id,
      response_type: 'code',
      state,
      scope: args.scope,
    },
  })) as { code: string; state: string };

  if (response.state === state) {
    const token = (await args.fetch({
      url: `oauth/token`,
      method: 'POST',
      formUrlencoded: {
        grant_type: 'authorization_code',
        client_id: args.client_id,
        client_secret: args.client_secret,
        code: response.code,
        redirect_uri: args.redirect_uri,
      },
    })) as Tokens;

    return token;
  }
  return null;
};
