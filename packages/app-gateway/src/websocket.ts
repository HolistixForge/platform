import * as http from 'http';
import * as https from 'https';
import ws from 'ws';
const u = require('y-websocket/bin/utils');

import { log, ForbiddenException } from '@monorepo/log';
import { ProjectRoomsManager } from './state/ProjectRooms';
import {
  extractJwtPayload,
  checkProjectAccess,
  type TAnyJwt,
} from './middleware/jwt-auth';
import type { TJwtUser } from '@monorepo/demiurge-types';

//
//

/**
 * Setup YJS WebSocket with Multi-Room Support
 *
 * Each project gets its own YJS room.
 * WebSocket path format: /collab/{room_id}?token=...
 * or /project/{project_id}?token=...
 *
 * @param servers - HTTP/HTTPS servers
 * @param projectRooms - Manager for all project rooms
 */
export function graftYjsWebsocket(
  servers: (http.Server | https.Server)[],
  projectRooms: ProjectRoomsManager
) {
  servers.forEach((server) => {
    const isSsl = server instanceof https.Server;
    const wss: ws.Server = new ws.Server(
      isSsl ? { server } : { noServer: true }
    );

    wss.on(
      'connection',
      (
        ws: ws,
        req: http.IncomingMessage,
        err: Error | null,
        jwt: TAnyJwt,
        room_id: string
      ) => {
        if (err) {
          ws.close(4001, 'REFRESH_TOKEN');
          return;
        }

        // Close socket when token expires (if exp is present)
        if ('exp' in jwt && typeof jwt.exp === 'number') {
          const currentTime = Date.now() / 1000;
          const timeDifference = jwt.exp - currentTime;
          if (timeDifference > 0) {
            setTimeout(() => {
              log(6, 'WS_CONNECTION', 'Closing socket - token expired');
              ws.close(4000, 'expired');
            }, timeDifference * 1000);
          }
        }

        log(6, 'WS_CONNECTION', `Connection: ${req.url}, room: ${room_id}`);

        // Setup YJS for this room
        u.setupWSConnection(ws, req, { docName: room_id, gc: false });
      }
    );

    if (!isSsl) {
      server.on('upgrade', (request, socket, head) => {
        // Authenticate and route to correct room
        authenticateAndRoute(
          request,
          projectRooms,
          function next(err, jwt, room_id) {
            if (err) {
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }

            if (!room_id) {
              socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
              socket.destroy();
              return;
            }

            try {
              wss.handleUpgrade(request, socket, head, function done(ws) {
                wss.emit('connection', ws, request, err, jwt, room_id);
              });
            } catch (error) {
              console.error('WebSocket upgrade error:', error);
            }
          }
        );
      });
    }
  });

  log(
    6,
    'WEBSOCKET',
    `Multi-room WebSocket grafted for ${projectRooms.getProjectCount()} projects`
  );
}

/**
 * Authenticate WebSocket connection and route to correct room
 *
 * URL formats supported:
 * - /collab/{room_id}?token=...
 * - /project/{project_id}?token=...
 */
function authenticateAndRoute(
  request: http.IncomingMessage,
  projectRooms: ProjectRoomsManager,
  callback: (
    err: Error | null,
    payload: TAnyJwt | null,
    room_id: string | null
  ) => void
) {
  const url = new URL(`https://localhost${request.url}`);
  const token = url.searchParams.get('token');
  const pathname = url.pathname;

  // Validate token
  if (!token) {
    callback(new Error('No token provided'), null, null);
    return;
  }

  let payload: TAnyJwt;
  try {
    payload = extractJwtPayload(token);
  } catch (err: any) {
    callback(err, null, null);
    return;
  }

  // Only accept user access tokens for WebSocket (not container tokens, org tokens, etc)
  if (payload.type !== 'access_token') {
    const err = new ForbiddenException([
      { message: 'Invalid JWT token: WebSocket requires user access_token' },
    ]);
    callback(err, null, null);
    return;
  }

  const userToken = payload as TJwtUser;

  // Route to correct room based on URL
  let room_id: string | null = null;

  // Format 1: /collab/{room_id}
  const collabMatch = pathname.match(/^\/collab\/([^/]+)$/);
  if (collabMatch) {
    const requested_room_id = collabMatch[1];
    // Verify this room exists
    const project_id = projectRooms.getProjectIdByRoomId(requested_room_id);
    if (project_id) {
      room_id = requested_room_id;
    }
  }

  // Format 2: /project/{project_id}
  const projectMatch = pathname.match(/^\/project\/([^/]+)$/);
  if (projectMatch) {
    const project_id = projectMatch[1];
    room_id = projectRooms.getRoomId(project_id) || null;
  }

  if (!room_id) {
    callback(new Error('Room not found'), null, null);
    return;
  }

  // Get project_id from room_id
  const project_id = projectRooms.getProjectIdByRoomId(room_id);
  if (!project_id) {
    callback(new Error('Project not found for room'), null, null);
    return;
  }

  // Check permission: user has access to this project
  const user_id = userToken.user?.id;
  if (!user_id) {
    callback(new Error('JWT missing user.id'), null, null);
    return;
  }

  // Check permissions using shared function
  const hasProjectAccess = checkProjectAccess(user_id, project_id);

  if (!hasProjectAccess) {
    callback(new Error(`No access to project: ${project_id}`), null, null);
    return;
  }

  callback(null, payload, room_id);
}
