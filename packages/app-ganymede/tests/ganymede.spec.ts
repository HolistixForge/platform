import {
  TJson,
  JsonValue,
  myfetch,
  TSerializableObject,
  TUri,
} from '@monorepo/simple-types';

//
//

const GANYMEDE_API_URL = `https://${process.env.GANYMEDE_FQDN}`;

//
//

const accessToken = process.env.ACCESS_TOKEN;

//

const project_id = 4;
let server_id: number | undefined = undefined;
const invalidProjectId = 879465;
const invalidServerId = 7946;

//
//

type TExpect =
  | { sc: number }
  | { [key: string]: string | number | Array<string | number> };

type TTest = {
  d: string;
  m: string;
  p: TUri | (() => TUri);
  fd?: TSerializableObject;
  json?: TJson | (() => TJson);
  formUrlencoded?: TSerializableObject | (() => TSerializableObject);
  expect: TExpect | (() => TExpect);
  headers?:
    | { [key: string]: string | undefined }
    | (() => { [key: string]: string | undefined });
  wait?: number;
  DISABLED?: boolean;
  timeout?: number;
  callback?: (r: JsonValue) => void;
};

//

const tests: TTest[] = [
  /**
   * jupyterlab pods's Ganymede API
   */

  {
    d: 'return jupyterhub verions in hedaer',
    m: 'GET',
    p: { url: '/' },
    expect: {
      sc: 200,
      'json.message': 'Ganymede',
      'headers.x-jupyterhub-version': '3.0.0',
    },
  },

  //

  /**
   * frontend's Ganymede API
   */

  {
    d: 'create a project named "The Project"',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: 'The Project' },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
      'json._0.project_id': 4,
    },
  },

  //

  {
    d: 'create a project with the same name, must fail',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: 'The Project' },
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'you already own a project with this name.',
    },
  },

  {
    d: 'create a project with empty name',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: '' },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must NOT have fewer than 1 characters',
    },
  },

  {
    d: 'create a project with name tool long',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: 'monorepomonorepo1' },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must NOT have more than 50 characters',
    },
  },

  //

  {
    d: 'create a project with invalid name, must fail',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: 'The-Project' },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must match pattern "^[a-zA-Z0-9_ ]*$"',
    },
  },

  {
    d: 'delete a project that does not exist',
    m: 'DELETE',
    p: {
      url: '/projects/[project_id]',
      pathParameters: { project_id: invalidProjectId },
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 404,
      'json.errors.0.message': 'Not Found: No such project',
    },
  },

  {
    d: 'delete a project that does not exist, not number id',
    m: 'DELETE',
    p: {
      url: '/projects/[project_id]',
      pathParameters: { project_id: 'nimportequoi' },
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must be number',
    },
  },

  {
    d: 'create a project named "The Project 2"',
    m: 'POST',
    p: { url: '/projects/new' },
    json: { name: 'The Project 2' },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
      'json._0.project_id': 6,
    },
  },

  {
    d: 'delete a project',
    m: 'DELETE',
    p: {
      url: '/projects/[project_id]',
      pathParameters: { project_id: 6 },
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  {
    d: 'create a new jupyter server with invalid name',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: invalidProjectId },
    },
    json: {
      name: 'server-1',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message': 'must match pattern "^[a-zA-Z0-9_ ]*$"',
      sc: 400,
    },
  },

  {
    d: 'create a new jupyter server for invalid project',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: invalidProjectId },
    },
    json: {
      name: 'server_1',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message': 'Not Found: No such project',
      sc: 404,
    },
  },

  {
    d: 'create a new jupyter server without name',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: project_id },
    },
    json: {
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': "must have required property 'name'",
    },
  },

  {
    d: 'create a new jupyter server',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: project_id },
    },
    json: {
      name: 'server_1',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
    callback: (r: JsonValue) => {
      server_id = r.get('json._0.project_server_id'.split('.')) as number;
    },
  },

  //

  {
    d: 'create a new jupyter server with same name',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: project_id },
    },
    json: {
      name: 'server_1',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'a server with this name exists yet.',
    },
  },

  {
    d: 'create a new jupyter server with empty name',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: project_id },
    },
    json: {
      name: '',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must NOT have fewer than 1 characters',
    },
  },

  {
    d: 'create a new jupyter server with too long name',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/servers',
      pathParameters: { project_id: project_id },
    },
    json: {
      name: 'server_1_011111111112222222222333333333344444444445',
      imageId: 2,
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 400,
      'json.errors.0.message': 'must NOT have more than 50 characters',
    },
  },

  {
    d: 'invalid API route',
    m: 'GET',
    p: {
      url: '/nimportequoi/ya/rien/ici',
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 404,
      'json.errors.0.message': 'not found',
    },
  },

  {
    d: 'list my project',
    m: 'GET',
    p: {
      url: '/me/projects',
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  {
    d: 'start jupyter server',
    timeout: 15000,
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/start',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  //

  {
    d: 'start jupyter server for invalid project id',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/start',
      pathParameters: { project_id: invalidProjectId, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 404,
      'json.errors.0.message': 'Not Found: No such project',
    },
  },

  //

  {
    d: 'start jupyter server for invalid server id',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/server/[server_id]/start',
      pathParameters: { project_id, server_id: invalidServerId },
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'this server does not exist.',
    },
  },

  //

  {
    d: 'start jupyter server that run yet',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/start',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'this server is running yet.',
    },
  },

  //

  {
    d: 'stop jupyter server for invalid project id',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/stop',
      pathParameters: { project_id: invalidProjectId, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 404,
      'json.errors.0.message': 'Not Found: No such project',
    },
  },

  //

  {
    d: 'stop jupyter server for invalid server id',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/server/[server_id]/stop',
      pathParameters: { project_id, server_id: invalidServerId },
    },
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'this server does not exist or is not running.',
    },
  },

  //

  {
    d: 'stop jupyter server that has not fully started yet TODO: try again later if failed',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/stop',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  //

  {
    d: 'stop jupyter server that has been stopped yet',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/stop',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'this server does not exist or is not running.',
    },
  },

  //

  {
    d: 'restart jupyter server',
    timeout: 15000,
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/start',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  //

  {
    d: 'delete a project with running servers',
    m: 'DELETE',
    p: () => ({
      url: '/projects/[project_id]',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message':
        'this project has one or more servers still running.',
    },
  },

  //

  {
    d: 'delete a server that is running',
    m: 'DELETE',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 500,
      'json.errors.0.message': 'stop the server before deleting.',
    },
  },

  //

  {
    d: 'delete a server that is not mine',
    m: 'DELETE',
    p: {
      url: '/projects/[project_id]/server/[server_id]',
      pathParameters: { project_id: 1, server_id: 1 },
    },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message':
        'Forbidden: You do not have permissions required for this action [delete-server]',
      sc: 403,
    },
  },

  //

  {
    d: 'share jupyter server for invalid project id',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/share',
      pathParameters: { project_id: invalidProjectId, server_id },
    }),
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message': 'Not Found: No such project',
      sc: 404,
    },
  },

  //

  {
    d: 'share jupyter server for invalid server id',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/server/[server_id]/share',
      pathParameters: { project_id, server_id: invalidServerId },
    },
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message': 'this server does not exist.',
      sc: 500,
    },
  },

  //

  {
    d: 'share jupyter server',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/share',
      pathParameters: { project_id, server_id },
    }),
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  {
    d: 'list the new jupyter server authorizations',
    m: 'GET',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/authorizations',
      pathParameters: { project_id, server_id },
    }),
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
      'json._0.0.user_id': 'b677ffdb-2a4a-4875-834c-fd2a64262a44',
    },
  },

  //

  {
    d: 'unshare jupyter server for invalid project id',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/unshare',
      pathParameters: { project_id: invalidProjectId, server_id },
    }),
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      sc: 404,
      'json.errors.0.message': 'Not Found: No such project',
    },
  },

  //

  {
    d: 'unshare jupyter server for invalid server id',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/server/[server_id]/unshare',
      pathParameters: { project_id, server_id: invalidServerId },
    },
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      'json.errors.0.message': 'this server does not exist.',
      sc: 500,
    },
  },

  //

  {
    d: 'unshare jupyter server that is not mine',
    m: 'POST',
    p: {
      url: '/projects/[project_id]/server/[server_id]/unshare',
      pathParameters: { project_id: 1, server_id: 2 },
    },
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      sc: 403,
      'json.errors.0.message':
        'Forbidden: You do not have permissions required for this action [unshare-server]',
    },
  },

  //

  {
    d: 'unshare jupyter server',
    m: 'POST',
    p: () => ({
      url: '/projects/[project_id]/server/[server_id]/unshare',
      pathParameters: { project_id, server_id },
    }),
    json: { user_id: 'b677ffdb-2a4a-4875-834c-fd2a64262a44' },
    headers: { authorization: accessToken },
    expect: {
      sc: 200,
    },
  },

  /*
   * TODO: test jupyterlab-pod's token are deleted when server is unshared
   */

  /*
   * TODO: test all previous but with bad authorization on objects
   */
];

//
//
//
//
//

describe('Testing the ganymede API', () => {
  for (let i = 0; i < tests.length; i++) {
    const test = tests[i];

    if (test.DISABLED) continue;

    if (test.timeout) jest.setTimeout(test.timeout);
    else jest.setTimeout(20000);

    it(test.d, async () => {
      if (test.wait) {
        await new Promise((resolve) => {
          setTimeout(() => {
            resolve(true);
          }, (test.wait || 0) * 1000);
        });
      }

      const p = typeof test.p === 'function' ? test.p() : test.p;

      const response = await myfetch({
        ...p,
        url: `${GANYMEDE_API_URL}${p.url}`,
        method: test.m,
        headers:
          typeof test.headers === 'function' ? test.headers() : test.headers,
        formData: test.fd,
        json: typeof test.json === 'function' ? test.json() : test.json,
        formUrlencoded:
          typeof test.formUrlencoded === 'function'
            ? test.formUrlencoded()
            : test.formUrlencoded,
      });

      const data = new JsonValue(response);

      const exp =
        typeof test.expect === 'function' ? test.expect() : test.expect;

      for (const k in exp) {
        const expected = exp[k];
        const value =
          k === 'sc' ? response.statusCode : data.get(k.split('.'), false);

        if (Array.isArray(exp[k])) expect(expected).toContain(value);
        else expect(value).toBe(expected);
      }

      if (test.callback) test.callback(data);
    });
  }
});
