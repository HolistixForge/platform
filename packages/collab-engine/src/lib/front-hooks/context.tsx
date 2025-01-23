import { log } from '@monorepo/log';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  ReactNode,
  DependencyList,
} from 'react';
import {
  TValidSharedData,
  Dispatcher,
  TEvent,
  TAwarenessUser,
  TCollaborativeChunk,
  TCollabNativeEvent,
  SharedTypes,
  YjsSharedTypes,
  NoneSharedTypes,
  compileChunks,
  Awareness,
  YjsAwareness,
  NoneAwareness,
  BrowserDispatcher,
  _AwarenessListenerArgs,
} from '../../index';
import { TokenMethods, getYDoc } from './ydocs';
import { buildUserCss } from './YjsCssStylesheet';
import * as YWS from 'y-websocket';
import { ApiFetch } from '@monorepo/api-fetch';

//
//
//

export type TYjsCollabConfig = {
  type: 'yjs';
  ws_server: string;
  token: TokenMethods;
};
export type TNoneCollabConfig = { type: 'none' };
export type TCollabConfig = TNoneCollabConfig | TYjsCollabConfig;

//

type TCollaborationContext = {
  sharedTypes: SharedTypes;
  sharedData: TValidSharedData;
  awareness: Awareness;
  dispatcher: Dispatcher<TEvent, Record<string, never>>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  extraContext: any;
};

//
//

const collaborationContext = createContext<TCollaborationContext | null>(null);

type CollaborativeContextProps = {
  children: ReactNode;
  id: string;
  collabChunks: TCollaborativeChunk[];
  config: TCollabConfig;
  eventApi: ApiFetch;
  user: TAwarenessUser;
};

//

type TState = {
  built: boolean;
  synced: boolean;
  error: null | Error;
};

//
//

export const CollaborativeContext = ({
  children,
  id,
  collabChunks,
  config,
  user,
  eventApi,
}: CollaborativeContextProps) => {
  //
  const [state, _setState] = useState<TState>({
    error: null,
    built: false,
    synced: false,
  });

  //

  const setState = (s: Partial<TState>) => {
    _setState((prev: TState) => ({
      ...prev,
      ...s,
    }));
  };

  //

  const v = useMemo(() => {
    log(7, 'COLLAB_INIT', 'collab context');

    let sharedTypes: SharedTypes;
    let awareness: Awareness;

    if (config.type === 'yjs') {
      const { ydoc, provider, syncedPromise } = getYDoc(
        id, // store uid
        id, // roomId
        config.ws_server, // server url
        {}, // no query parameters
        config.token
      );
      syncedPromise?.then((synced) => setState({ synced }));

      sharedTypes = new YjsSharedTypes(ydoc);
      awareness = new YjsAwareness(
        ydoc,
        provider as YWS.WebsocketProvider,
        buildUserCss
      );
    } else {
      sharedTypes = new NoneSharedTypes();
      awareness = new NoneAwareness();
    }
    awareness.setUser(user);
    const dispatcher = new BrowserDispatcher(eventApi);
    const extraContext = {};
    const loadChunks = compileChunks(collabChunks, dispatcher, extraContext);
    const sharedData = loadChunks(sharedTypes);
    dispatcher.bindData(sharedTypes, sharedData);
    setState({ built: true });

    return { sharedTypes, awareness, sharedData, dispatcher, extraContext };
  }, [config, user, eventApi, collabChunks, id]);

  //
  //

  log(7, 'COLLAB_INIT', 'CollaborativeContext update', {
    state: state,
    context: v,
  });

  if (!state.built)
    return (
      <span className="loading-message">Building collaborative space</span>
    );
  else if (!state.synced)
    return (
      <span className="loading-message">Synchronizing collaboration data</span>
    );
  else if (state.error)
    return (
      <span className="loading-message error">{state.error?.message}</span>
    );
  else
    return (
      <collaborationContext.Provider value={v}>
        {children}
      </collaborationContext.Provider>
    );
};

//
//
//

export const useAwareness = () => {
  const { awareness } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return { awareness };
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function useAwarenessListenData(
  callback: (a: _AwarenessListenerArgs, awareness: Awareness) => void,
  deps: DependencyList
): void {
  //

  const { awareness } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  //
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const cb = useCallback(callback, [...deps]);

  useEffect(() => {
    awareness.addAwarenessListener(cb);
    cb(
      { states: awareness.getStates(), added: [], updated: [], removed: [] },
      awareness
    );
    return () => {
      awareness.removeAwarenessListener(cb);
    };
  }, [awareness, cb]);
}

//
//
//

export type TSharedDataHook<TShDt> = <U>(
  observe: Array<keyof TShDt>,
  f: (data: TShDt) => U
) => U;

//
//

export const useSharedData = <TSharedData extends TValidSharedData>(
  observe: Array<keyof TSharedData>,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  f: (data: TSharedData) => any
): ReturnType<typeof f> => {
  const { sharedData } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  const [, refresh] = useState({});

  const updateComponent = useCallback(() => refresh({}), []);

  useEffect(() => {
    observe.forEach((key) => {
      if ((sharedData as TSharedData)[key]) {
        sharedData[key].observe(updateComponent);
      }
    });
    return () => {
      observe.forEach((key) => {
        if ((sharedData as TSharedData)[key]) {
          sharedData[key].unobserve(updateComponent);
        }
      });
    };
  }, [sharedData, observe, updateComponent]);

  return f(sharedData as TSharedData);
};

//
//

export const useDispatcher = <TE extends TEvent>() => {
  const { dispatcher } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return dispatcher as Dispatcher<
    TE | TCollabNativeEvent,
    Record<string, never>
  >;
};

//
//

export const useExtraContext = <T,>() => {
  const { extraContext } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return extraContext as T;
};
