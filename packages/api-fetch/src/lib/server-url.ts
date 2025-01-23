/**
 * return a full url for a server, ssl default to true
 */

export const serverUrl = (a: {
  host: string;
  location: string;
  websocket?: boolean;
  ssl?: boolean;
  port?: number;
}) => {
  const { host, location, websocket, ssl, port } = a;

  let l = location;
  if (!l.startsWith('/')) l = `/${l}`;

  let protocol = 'http';
  if (websocket) protocol = 'ws';
  if (ssl === undefined || ssl === true) protocol = `${protocol}s`;

  return `${protocol}://${host}:${port || ''}${l}`;
};
