import { useHotkeys } from 'react-hotkeys-hook';

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
  _AwarenessListenerArgs,
} from '../../index';
import { TokenMethods, getYDoc } from './ydocs';
import { buildUserCss } from './YjsCssStylesheet';
import * as YWS from 'y-websocket';
import { sharedDataToJson } from '../chunk';

import './context.scss';

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
  dispatcher: Dispatcher<any, Record<string, never>>;

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
  dispatcher: Dispatcher<any, any>;
  user: TAwarenessUser;
  onError?: () => void;
};

//

type TState = {
  built: boolean;
  synced: boolean;
  error: null | Error;
};

type TConnectionError = {
  timestamp: number;
  error: Event;
};

//
//

export const CollaborativeContext = ({
  children,
  id,
  collabChunks,
  config,
  user,
  dispatcher,
  onError,
}: CollaborativeContextProps) => {
  //
  const [state, _setState] = useState<TState>({
    error: null,
    built: false,
    synced: false,
  });

  const [connectionErrors, setConnectionErrors] = useState<TConnectionError[]>(
    []
  );

  const addError = useCallback(
    (error: Event) => {
      setConnectionErrors((prev) => {
        const now = Date.now();
        // Filter errors from last 20 seconds and add new error
        const recentErrors = [
          ...prev.filter((e) => now - e.timestamp < 20000),
          { timestamp: now, error },
        ];

        // If we have 5 or more errors in the last 20 seconds, trigger onError callback
        if (recentErrors.length >= 4 && onError) {
          onError();
        }

        return recentErrors;
      });
    },
    [onError]
  );

  const resetErrors = useCallback(() => {
    setConnectionErrors([]);
  }, []);

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

      provider.on('connection-error', (event: Event) => {
        log(
          7,
          'COLLAB',
          `provider.connection-error: ${config.ws_server} : ${id}`,
          event
        );
        addError(event);
      });

      provider.on('sync', (state: boolean) => {
        log(7, 'COLLAB', `provider.sync: ${config.ws_server} : ${id}`, state);
        setState({ synced: state });
        if (state) {
          resetErrors();
        }
      });

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
      setState({ synced: true });
    }
    awareness.setUser(user);

    const extraContext = {};
    const loadChunks = compileChunks(collabChunks, dispatcher, extraContext);
    const sharedData = loadChunks(sharedTypes);
    dispatcher.bindData(sharedTypes, sharedData, extraContext);

    setState({ built: true });

    return { sharedTypes, awareness, sharedData, dispatcher, extraContext };
  }, [config, user, collabChunks, id, addError, resetErrors]);

  //

  useHotkeys(
    'ctrl+shift+d',
    () => {
      console.log('Shared Data Snapshot:', sharedDataToJson(v.sharedData));
    },
    [v.sharedData]
  );

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
        {connectionErrors.length > 0 && (
          <div className="collab-error-overlay">
            <div className="error-content">
              <div className="error-title">Connection Error</div>
              <div className="error-message">Waiting for reconnection...</div>
              <div className="error-count">
                {connectionErrors.length} error
                {connectionErrors.length > 1 ? 's' : ''} in the last 20 seconds
              </div>
            </div>
          </div>
        )}
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

export const useDispatcher = <TE,>() => {
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
