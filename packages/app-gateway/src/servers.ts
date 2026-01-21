/**
 * Global server registry for WebSocket grafting
 * Stores HTTP/HTTPS server instances for WebSocket upgrade handling
 */
import * as http from 'http';
import * as https from 'https';

let serversRegistry: (http.Server | https.Server)[] = [];

export function setServers(servers: (http.Server | https.Server)[]): void {
  serversRegistry = servers;
}

export function getServers(): (http.Server | https.Server)[] {
  return serversRegistry;
}
