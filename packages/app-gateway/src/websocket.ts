import * as http from 'http';
import * as https from 'https';
import ws from 'ws';
const u = require('y-websocket/bin/utils');

import { EPriority, log, ForbiddenException } from '@holistix/log';
import { ProjectRoomsManager } from './state/ProjectRooms';
import {
  extractJwtPayload,
  checkProjectAccess,
  type TAnyJwt,
} from './middleware/jwt-auth';
import type { TJwtUser } from '@holistix/demiurge-types';
import { trace, context, SpanStatusCode } from '@opentelemetry/api';

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
        // Create span for WebSocket connection
        const tracer = trace.getTracer('app-gateway', '1.0.0');
        const connectionSpan = tracer.startSpan('websocket.connection', {
          attributes: {
            'websocket.room_id': room_id,
            'http.url': req.url || '',
          },
        });

        // Get project_id from room_id
        const project_id = projectRooms.getProjectIdByRoomId(room_id);
        if (project_id) {
          connectionSpan.setAttribute('project.id', project_id);
        }

        // Set user context if available
        if (jwt && 'user' in jwt && jwt.user?.id) {
          const userToken = jwt as TJwtUser;
          connectionSpan.setAttribute('user.id', userToken.user.id);
        }

        // Store span context in WebSocket for later use (e.g., message propagation)
        (ws as any).__otelSpan = connectionSpan;
        (ws as any).__otelContext = context.active();

        if (err) {
          connectionSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: err.message,
          });
          connectionSpan.recordException(err);
          connectionSpan.setAttribute('error.type', 'WS_CONNECTION_ERROR');
          connectionSpan.end();
          ws.close(4001, 'REFRESH_TOKEN');
          return;
        }

        // Close socket when token expires (if exp is present)
        if ('exp' in jwt && typeof jwt.exp === 'number') {
          const currentTime = Date.now() / 1000;
          const timeDifference = jwt.exp - currentTime;
          if (timeDifference > 0) {
            setTimeout(() => {
              connectionSpan.setAttribute(
                'websocket.close_reason',
                'token_expired'
              );
              connectionSpan.setAttribute('websocket.close_code', 4000);
              log(
                EPriority.Info,
                'WS_CONNECTION',
                'Closing socket - token expired'
              );
              connectionSpan.end();
              ws.close(4000, 'expired');
            }, timeDifference * 1000);
          }
        }

        // Set connection success attributes
        connectionSpan.setAttribute('websocket.connected', true);

        log(
          EPriority.Info,
          'WS_CONNECTION',
          `Connection: ${req.url}, room: ${room_id}`
        );

        // Handle WebSocket close
        ws.on('close', (code, reason) => {
          connectionSpan.setAttribute('websocket.close_code', code);
          connectionSpan.setAttribute(
            'websocket.close_reason',
            reason.toString()
          );
          connectionSpan.end();
        });

        // Handle WebSocket error
        ws.on('error', (error) => {
          connectionSpan.setStatus({
            code: SpanStatusCode.ERROR,
            message: error.message,
          });
          connectionSpan.recordException(error);
          connectionSpan.setAttribute('error.type', 'WS_ERROR');
          connectionSpan.end();
        });

        // Setup YJS for this room
        u.setupWSConnection(ws, req, { docName: room_id, gc: false });
      }
    );

    if (!isSsl) {
      server.on('upgrade', (request, socket, head) => {
        // Create span for WebSocket upgrade
        const tracer = trace.getTracer('app-gateway', '1.0.0');
        const upgradeSpan = tracer.startSpan('websocket.upgrade', {
          attributes: {
            'http.method': 'GET',
            'http.url': request.url || '',
            'websocket.upgrade': true,
          },
        });

        // Authenticate and route to correct room
        authenticateAndRoute(
          request,
          projectRooms,
          function next(err, jwt, room_id) {
            if (err) {
              // Log authentication failure with error classification
              upgradeSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: err.message,
              });
              upgradeSpan.recordException(err);
              upgradeSpan.setAttribute('error.type', 'WS_AUTH_FAILED');
              upgradeSpan.setAttribute('error.category', 'USER_ERROR');

              log(
                EPriority.Warning,
                'WS_AUTH',
                `Authentication failed: ${err.message}`,
                {
                  error_type: 'WS_AUTH_FAILED',
                  error_message: err.message,
                  url: request.url,
                }
              );

              upgradeSpan.end();
              socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
              socket.destroy();
              return;
            }

            if (!room_id) {
              // Log room not found error
              upgradeSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: 'Room not found',
              });
              upgradeSpan.setAttribute('error.type', 'WS_ROOM_NOT_FOUND');
              upgradeSpan.setAttribute('error.category', 'USER_ERROR');

              log(EPriority.Warning, 'WS_AUTH', 'Room not found', {
                error_type: 'WS_ROOM_NOT_FOUND',
                url: request.url,
              });

              upgradeSpan.end();
              socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
              socket.destroy();
              return;
            }

            try {
              // Set success attributes before upgrade
              upgradeSpan.setAttribute('websocket.room_id', room_id);
              const project_id = projectRooms.getProjectIdByRoomId(room_id);
              if (project_id) {
                upgradeSpan.setAttribute('project.id', project_id);
              }

              wss.handleUpgrade(request, socket, head, function done(ws) {
                // End upgrade span and start connection span (connection handler will create it)
                upgradeSpan.end();
                wss.emit('connection', ws, request, err, jwt, room_id);
              });
            } catch (error: any) {
              // Log upgrade error with proper classification
              upgradeSpan.setStatus({
                code: SpanStatusCode.ERROR,
                message: error.message || 'WebSocket upgrade failed',
              });
              upgradeSpan.recordException(error);
              upgradeSpan.setAttribute('error.type', 'WS_UPGRADE_ERROR');
              upgradeSpan.setAttribute('error.category', 'APP_ERROR');

              log(
                EPriority.Error,
                'WS_UPGRADE',
                `WebSocket upgrade error: ${error.message}`,
                {
                  error_type: 'WS_UPGRADE_ERROR',
                  error_message: error.message,
                  error_stack: error.stack,
                  url: request.url,
                }
              );

              upgradeSpan.end();
            }
          }
        );
      });
    }
  });

  log(
    EPriority.Info,
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
    const err = new Error('No token provided');
    log(EPriority.Warning, 'WS_AUTH', 'No token provided', {
      error_type: 'WS_NO_TOKEN',
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  let payload: TAnyJwt;
  try {
    payload = extractJwtPayload(token);
  } catch (err: any) {
    log(EPriority.Warning, 'WS_AUTH', `Invalid token: ${err.message}`, {
      error_type: 'WS_INVALID_TOKEN',
      error_message: err.message,
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  // Only accept user access tokens for WebSocket (not container tokens, org tokens, etc)
  if (payload.type !== 'access_token') {
    const err = new ForbiddenException([
      { message: 'Invalid JWT token: WebSocket requires user access_token' },
    ]);
    log(EPriority.Warning, 'WS_AUTH', 'Invalid token type for WebSocket', {
      error_type: 'WS_INVALID_TOKEN_TYPE',
      token_type: payload.type,
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  const userToken = payload as TJwtUser;

  // Route to correct room based on URL
  let room_id: string | null = null;
  let project_id: string | null = null;

  // Format 1: /collab/{room_id}
  const collabMatch = pathname.match(/^\/collab\/([^/]+)$/);
  if (collabMatch) {
    const requested_room_id = collabMatch[1];
    // Verify this room exists
    const found_project_id =
      projectRooms.getProjectIdByRoomId(requested_room_id);
    if (found_project_id) {
      project_id = found_project_id;
      room_id = requested_room_id;
    }
  }

  // Format 2: /project/{project_id}
  const projectMatch = pathname.match(/^\/project\/([^/]+)$/);
  if (projectMatch) {
    project_id = projectMatch[1];
    room_id = projectRooms.getRoomId(project_id) || null;
  }

  if (!room_id) {
    const err = new Error('Room not found');
    log(EPriority.Warning, 'WS_AUTH', 'Room not found', {
      error_type: 'WS_ROOM_NOT_FOUND',
      pathname: pathname,
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  // Get project_id from room_id if not already set
  if (!project_id) {
    project_id = projectRooms.getProjectIdByRoomId(room_id) || null;
  }

  if (!project_id) {
    const err = new Error('Project not found for room');
    log(EPriority.Error, 'WS_AUTH', 'Project not found for room', {
      error_type: 'WS_PROJECT_NOT_FOUND',
      room_id: room_id,
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  // Check permission: user has access to this project
  const user_id = userToken.user?.id;
  if (!user_id) {
    const err = new Error('JWT missing user.id');
    log(EPriority.Warning, 'WS_AUTH', 'JWT missing user.id', {
      error_type: 'WS_JWT_MISSING_USER_ID',
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  // Check permissions using shared function
  const hasProjectAccess = checkProjectAccess(user_id, project_id);

  if (!hasProjectAccess) {
    const err = new Error(`No access to project: ${project_id}`);
    log(EPriority.Warning, 'WS_AUTH', `No access to project: ${project_id}`, {
      error_type: 'WS_NO_PROJECT_ACCESS',
      user_id: user_id,
      project_id: project_id,
      url: request.url,
    });
    callback(err, null, null);
    return;
  }

  callback(null, payload, room_id);
}
