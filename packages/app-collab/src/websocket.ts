import * as http from 'http';
import * as https from 'https';
import ws from 'ws';
const u = require('y-websocket/bin/utils');

import { jwtPayload } from '@monorepo/backend-engine';
import { log, ForbiddenException } from '@monorepo/log';
import { makeProjectScopeString } from '@monorepo/demiurge-types';

import { PROJECT } from './project-config';

//
//
//

type MyJwtPayload = { type: string; scope: string[]; exp: number };

//

export function graftYjsWebsocket(
  servers: (http.Server | https.Server)[],
  roomId: string
) {
  //

  servers.forEach((server) => {
    const isSsl = server instanceof https.Server;
    const wss: ws.Server = new ws.Server(
      isSsl ? { server } : { noServer: true }
    );

    //

    wss.on(
      'connection',
      (
        ws: ws,
        req: http.IncomingMessage,
        err: Error | null,
        jwt: MyJwtPayload
      ) => {
        if (err) {
          ws.close(4001, 'REFRESH_TOKEN');
          return;
        }

        // close socket when the token will expire
        const currentTime = Date.now() / 1000; // Get current time in seconds
        const timeDifference = jwt.exp - currentTime;
        if (timeDifference > 0) {
          setTimeout(() => {
            log(6, 'WS_CONNECTION', 'destroy socket, token expired');
            ws.close(4000, 'expired');
          }, timeDifference * 1000); // Convert seconds to milliseconds
        }

        log(6, 'WS_CONNECTION', `connection: url: ${req.url}`);

        // Extract UUID from URL path
        const urlPath = req.url?.split('?')[0]; // Get path without query params
        const match = urlPath?.match(/\/collab\/([^/]+)/);
        const uuid = match?.[1];

        if (!uuid) {
          log(6, 'WS_CONNECTION', 'Invalid URL format - missing room id UUID');
          ws.close(3003, 'invalid_url');
          return;
        }

        if (uuid !== roomId) {
          log(6, 'WS_CONNECTION', 'Invalid room id', { uuid, roomId });
          ws.close(3003, 'invalid_room_id');
          return;
        }

        log(6, 'WS_CONNECTION', `room id UUID: ${uuid}`);

        // setup Yjs
        u.setupWSConnection(ws, req, { docName: roomId, gc: false });
      }
    );

    //

    if (!isSsl) {
      server.on('upgrade', (request, socket, head) => {
        authenticate(request, function next(err, jwt) {
          if (err && err.constructor.name !== 'OAuthRefreshTokenException') {
            socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
            socket.destroy();
            return;
          }

          try {
            wss.handleUpgrade(request, socket, head, function done(ws) {
              wss.emit('connection', ws, request, err, jwt);
            });
          } catch (error) {
            console.log(error); // TODO
          }
        });
      });
    }
  });
}

//

//

function authenticate(
  request: http.IncomingMessage,
  callback: (e: Error | null, payload: MyJwtPayload | null) => void
) {
  const u = new URL(`https://localhost${request.url}`);
  const token = u.searchParams.get('token');

  let payload: MyJwtPayload;
  if (!token) {
    callback(new Error('Forbidden'), null);
    return;
  }

  try {
    payload = jwtPayload(token) as MyJwtPayload;
  } catch (err: any) {
    callback(err, null);
    return;
  }

  if (!payload || payload.type !== 'access_token') {
    const err = new ForbiddenException([
      { message: `invalid jwt token: not an access token` },
    ]);
    callback(err, null);
    return;
  }

  if (!payload.scope.includes(makeProjectScopeString(PROJECT!.PROJECT_ID))) {
    const err = new ForbiddenException([{ message: `insufficient scope` }]);
    callback(err, null);
    return;
  }

  callback(null, payload);
}
