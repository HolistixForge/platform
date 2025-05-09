import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';
import { log } from '@monorepo/log';

const debug = (msg: string) => log(7, 'YDOC_STORE', msg);

type DocBack = {
  ydoc: Doc;
};

type DocFront = DocBack & {
  provider: WebsocketProvider;
  syncedPromise: Promise<boolean>;
};

// yjs doc and provider store
const docs = new Map<string, DocBack | DocFront>();

// store token method (get, refresh) for every websocket server
const tokensMethods = new Map<string, TokenMethods | null>();

// find the token methods for a given server url
const getTokenMethods = (url: string): TokenMethods | null | undefined => {
  for (const [key, value] of tokensMethods.entries()) {
    if (url.includes(key)) return value;
  }
  return null;
};

//
// we extends WebSocket to inject user JWT token in url
// and catch token expiration error, to trig a refresh
//

class MyWebSocket extends WebSocket {
  constructor(url: string | URL, protocols?: string | string[]) {
    //

    debug(`new MyWebSocket: ${url}`);

    // get token from URL, then concat
    let token = '';
    const tm = getTokenMethods(url as string);
    if (tm) token = tm.get();

    if (token !== '') {
      const fu = new URL(url);
      fu.searchParams.append('token', token);
      url = fu.toString();
    }

    super(url, protocols);

    // catch refresh token error
    this.addEventListener('close', (event: CloseEvent) => {
      debug(`MyWebSocket.close: ${url} [${event.code}]`);
      if (event.code === 4001) {
        this.close();
        tm?.refresh?.();
      }
    });
  }
}

//
export type TokenMethods = {
  get: () => string;
  refresh?: () => void;
};

//

export const getYDoc = (
  id: string,
  roomId: string,
  server_url: string,
  params: { [k: string]: string },
  tm: TokenMethods | null
): DocFront => {
  //
  debug(`getYDoc ${server_url} : ${roomId}`);

  const yet = docs.get(id);
  if (yet) return yet as DocFront;

  //else
  tokensMethods.set(server_url, tm);

  const ydoc = new Doc();

  const syncedPromise: Promise<boolean> = new Promise((resolve) => {
    ydoc.once('update', () => {
      debug(`syncedPromise resolved ${server_url} : ${roomId}`);
      resolve(true);
    });
  });

  const provider = new WebsocketProvider(server_url, roomId, ydoc, {
    WebSocketPolyfill: MyWebSocket,
    params,
  });

  const newDoc: DocFront = { ydoc, provider, syncedPromise };
  docs.set(id, newDoc);
  return newDoc;
};
