import * as u from 'y-websocket/bin/utils';
import { Doc } from 'yjs';
import { WebsocketProvider } from 'y-websocket';

import { log, EPriority } from '@holistix/log';
import { TJson } from '@holistix/shared-types';
import {
  SharedEditor,
  SharedTypes,
  Awareness,
  TValidSharedData,
  YjsAwareness,
  YjsSharedEditor,
  YjsSharedTypes,
  NoneSharedTypes,
  NoneAwareness,
  NoneSharedEditor,
  TAwarenessUser,
  SharedMap,
  SharedArray,
} from '@holistix/collab-engine';

//

const EDITORS_YTEXT_YMAP_KEY = 'editors';

//

export abstract class Collab<T extends TValidSharedData> {
  public sharedData: T = {} as T;

  public abstract sharedTypes: SharedTypes;

  public abstract sharedEditor: SharedEditor;

  public abstract awareness: Awareness;

  public abstract init(config: object): void;

  public loadSharedData<T extends TJson>(
    sdtype: 'map',
    moduleName: string,
    name: string
  ): SharedMap<T>;
  public loadSharedData<T extends TJson>(
    sdtype: 'array',
    moduleName: string,
    name: string
  ): SharedArray<T>;
  public loadSharedData<T extends TJson>(
    sdtype: 'map' | 'array',
    moduleName: string,
    name: string
  ): SharedMap<T> | SharedArray<T> {
    const fullname = `${moduleName}:${name}`;
    if (sdtype === 'map') {
      const map = this.sharedTypes.getSharedMap(fullname) as SharedMap<T>;
      Object.assign(this.sharedData, {
        [fullname]: map,
      });
      return map;
    } else if (sdtype === 'array') {
      const array = this.sharedTypes.getSharedArray(fullname) as SharedArray<T>;
      Object.assign(this.sharedData, {
        [fullname]: array,
      });
      return array;
    }
    throw new Error(`Invalid shared data type: ${sdtype}`);
  }
}

//

export type YjsClientCollabConfig = {
  type: 'yjs-client';
  room_id: string;
  ws_server: string;
  token: {
    get: () => string;
    refresh: () => void;
  };
  user: TAwarenessUser;
};

//

export class YjsClientCollab extends Collab<TValidSharedData> {
  public override awareness!: Awareness;
  public override sharedTypes!: SharedTypes;
  public override sharedEditor!: SharedEditor;

  private ydoc!: Doc;
  private provider!: WebsocketProvider;
  private errors: Event[] = [];
  private _synced!: Promise<boolean>;
  private static ydocs: Map<string, { doc: Doc; provider: WebsocketProvider }> =
    new Map();

  constructor(config: YjsClientCollabConfig) {
    super();
    this.init(config);
  }

  private getClientYDoc(config: YjsClientCollabConfig): {
    doc: Doc;
    provider: WebsocketProvider;
  } {
    const r = YjsClientCollab.ydocs.get(config.room_id);
    if (r) return r;

    const doc = new Doc();

    MyWebSocket.websocketArgs.set(config.ws_server, {
      getToken: config.token.get,
      refreshToken: config.token.refresh,
    });

    const provider = new WebsocketProvider(
      config.ws_server,
      config.room_id,
      doc,
      {
        WebSocketPolyfill: MyWebSocket,
        params: {}, // no query parameters
      }
    );

    YjsClientCollab.ydocs.set(config.room_id, { doc, provider });

    return { doc, provider };
  }

  public override init(config: YjsClientCollabConfig): void {
    if (this.ydoc) {
      this.provider.awareness.destroy();
      this.provider.disconnect();
      this.provider.destroy();
      this.ydoc.destroy();
    }
    this.resetErrors();

    const { doc, provider } = this.getClientYDoc(config);
    this.ydoc = doc;
    this.provider = provider;
    this.sharedData = {};
    this.sharedTypes = new YjsSharedTypes(doc);
    this.sharedEditor = new YjsSharedEditor(doc.getMap(EDITORS_YTEXT_YMAP_KEY));
    this.awareness = new YjsAwareness(doc, provider.awareness);
    this.awareness.setUser(config.user);

    provider.on('connection-error', (event: Event) => {
      log(EPriority.Debug, 'COLLAB', `provider.connection-error`, event);
      this.addError(event);
    });

    provider.on('connection-close', (event: CloseEvent | null) => {
      log(EPriority.Debug, 'COLLAB', `provider.connection-close`, event);
      if (event?.code === 3003) {
        this.addError(event);
      }
    });

    provider.on('sync', (state: boolean) => {
      log(EPriority.Debug, 'COLLAB', `provider.sync`, state);
      if (state) {
        this.resetErrors();
      }
    });

    this._synced = new Promise((resolve) => {
      this.ydoc.once('update', () => {
        log(EPriority.Debug, 'COLLAB', `ydoc.update`);
        resolve(true);
      });
    });
  }

  public get synced(): Promise<boolean> {
    return this._synced;
  }

  private resetErrors(): void {
    this.errors = [];
  }

  private addError(error: Event): void {
    this.errors.push(error);
  }
}

//

export type YjsServerCollabConfig = {
  type: 'yjs-server';
  room_id: string;
};

export class YjsServerCollab extends Collab<TValidSharedData> {
  public override sharedTypes!: SharedTypes;
  public override sharedEditor!: SharedEditor;
  public override awareness!: Awareness;

  constructor(config: YjsServerCollabConfig) {
    super();
    this.init(config);
  }

  public override init(config: YjsServerCollabConfig): void {
    this.sharedData = {};
    const ydoc = u.getYDoc(config.room_id);
    this.sharedTypes = new YjsSharedTypes(ydoc);
    this.sharedEditor = new YjsSharedEditor(
      ydoc.getMap(EDITORS_YTEXT_YMAP_KEY)
    );
    this.awareness = new YjsAwareness(ydoc, ydoc.awareness);
  }
}

//

//
// we extends WebSocket to inject user JWT token in url
// and catch token expiration error, to trig a refresh
//

type TWebsocketArgs = {
  getToken: () => string;
  refreshToken: () => void;
};

class MyWebSocket extends WebSocket {
  public static websocketArgs: Map<string, TWebsocketArgs> = new Map();

  constructor(url: string | URL, protocols?: string | string[]) {
    // get token from URL, then concat
    let token = '';
    const args = MyWebSocket.websocketArgs.get(url as string);
    if (args) token = args.getToken();

    if (token !== '') {
      const fu = new URL(url);
      fu.searchParams.append('token', token);
      url = fu.toString();
    }

    super(url, protocols);

    // catch refresh token error
    this.addEventListener('close', (event: CloseEvent) => {
      log(EPriority.Debug, 'COLLAB', `MyWebSocket.close: ${url} [${event.code}]`);
      if (event.code === 4001) {
        this.close();
        args?.refreshToken();
      }
    });
  }
}

//

export type NoneCollabConfig = {
  type: 'none';
  room_id: string;
  simulateUsers: boolean;
  user: TAwarenessUser;
};

export class NoneCollab extends Collab<TValidSharedData> {
  public override sharedTypes!: SharedTypes;
  public override sharedEditor!: SharedEditor;
  public override awareness!: Awareness;

  constructor(config: NoneCollabConfig) {
    super();
    this.init(config);
  }

  public override init(config: NoneCollabConfig): void {
    this.sharedData = {};
    this.sharedTypes = new NoneSharedTypes(config.room_id);
    this.sharedEditor = new NoneSharedEditor();
    this.awareness = new NoneAwareness(config.simulateUsers);
    this.awareness.setUser(config.user);
  }
}
