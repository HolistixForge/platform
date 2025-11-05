import * as http from 'http';
import * as https from 'https';
import ws from 'ws';
const u = require('y-websocket/bin/utils');

import { jwtPayload } from '@monorepo/backend-engine';
import { log, ForbiddenException } from '@monorepo/log';
import { ProjectRoomsManager } from './state/ProjectRooms';

//
//

type MyJwtPayload = { 
  type: string; 
  user_id?: string;
  scope: string[]; 
  exp: number;
};

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
        jwt: MyJwtPayload,
        room_id: string
      ) => {
        if (err) {
          ws.close(4001, 'REFRESH_TOKEN');
          return;
        }

        // Close socket when token expires
        const currentTime = Date.now() / 1000;
        const timeDifference = jwt.exp - currentTime;
        if (timeDifference > 0) {
          setTimeout(() => {
            log(6, 'WS_CONNECTION', 'Closing socket - token expired');
            ws.close(4000, 'expired');
          }, timeDifference * 1000);
        }

        log(6, 'WS_CONNECTION', `Connection: ${req.url}, room: ${room_id}`);

        // Setup YJS for this room
        u.setupWSConnection(ws, req, { docName: room_id, gc: false });
      }
    );

    if (!isSsl) {
      server.on('upgrade', (request, socket, head) => {
        // Authenticate and route to correct room
        authenticateAndRoute(request, projectRooms, function next(err, jwt, room_id) {
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
        });
      });
    }
  });

  log(6, 'WEBSOCKET', `Multi-room WebSocket grafted for ${projectRooms.getProjectCount()} projects`);
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
    payload: MyJwtPayload | null,
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

  let payload: MyJwtPayload;
  try {
    payload = jwtPayload(token) as MyJwtPayload;
  } catch (err: any) {
    callback(err, null, null);
    return;
  }

  if (!payload || payload.type !== 'access_token') {
    const err = new ForbiddenException([
      { message: 'Invalid JWT token: not an access token' },
    ]);
    callback(err, null, null);
    return;
  }

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

  // TODO: Check permission - user has access to this project
  // For now, just check token is valid

  callback(null, payload, room_id);
}
