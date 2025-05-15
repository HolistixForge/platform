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
import { useHotkeys } from 'react-hotkeys-hook';
import * as YWS from 'y-websocket';

import { log } from '@monorepo/log';
import { TJsonObject } from '@monorepo/simple-types';

import {
  TValidSharedData,
  FrontendDispatcher,
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
  BackendEventProcessor,
} from '../../index';
import { TokenMethods, getYDoc } from './ydocs';
import { buildUserCss } from './YjsCssStylesheet';
import { sharedDataToJson } from '../chunk';
import { NoneSharedEditor, SharedEditor } from '../SharedEditor';
import { YjsSharedEditor } from '../yjs/YjsSharedEditor';
import { bindEditor } from './bind-editor';
import { EDITORS_YTEXT_YMAP_KEY } from '../yjs/YjsSharedEditor';
import {
  FrontendEventSequence,
  LocalReduceFunction,
} from './frontendEventSequence';
import {
  LocalOverrider,
  SharedDataManager,
  TValidSharedDataToCopy,
} from './localOverrider';

import './context.scss';

//
//
//

export type TYjsCollabConfig = {
  type: 'yjs';
  ws_server: string;
  token: TokenMethods;
};
export type TNoneCollabConfig = { type: 'none'; simulateUsers?: boolean };
export type TCollabConfig = TNoneCollabConfig | TYjsCollabConfig;

//

export type TCollaborationContext = {
  sharedTypes: SharedTypes;
  sharedData: TValidSharedData;
  localOverrider: LocalOverrider<TValidSharedData>;
  awareness: Awareness;
  dispatcher: FrontendDispatcher<any>;
  sharedEditor: SharedEditor;
  extraContext: any;
  cleanup: () => void;
};

//
//

const collaborationContext = createContext<TCollaborationContext | null>(null);

type CollaborativeContextProps = {
  children: ReactNode;
  id: string;
  collabChunks: TCollaborativeChunk[];
  config: TCollabConfig;
  dispatcher: FrontendDispatcher<any>;
  user: TAwarenessUser;
  /** ONLY USE THIS IF YOU ARE USING A MOCK COLLABORATIVE CONTEXT */
  bep?: BackendEventProcessor<any, any>;
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

export const useCollaborativeContextInternal = ({
  id,
  collabChunks,
  config,
  user,
  dispatcher,
  onError,
  bep,
}: Omit<CollaborativeContextProps, 'children'>) => {
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

  const context = useMemo<TCollaborationContext>(() => {
    log(7, 'COLLAB_INIT', 'collab context');

    let sharedTypes: SharedTypes;
    let awareness: Awareness;
    let provider: YWS.WebsocketProvider | undefined;
    let ydoc: any;
    let sharedEditor: SharedEditor | undefined;

    if (config.type === 'yjs') {
      const result = getYDoc(
        id, // store uid
        id, // roomId
        config.ws_server, // server url
        {}, // no query parameters
        config.token
      );

      ydoc = result.ydoc;
      provider = result.provider;

      provider.on('connection-error', (event: Event) => {
        log(
          7,
          'COLLAB',
          `provider.connection-error: ${config.ws_server} : ${id}`,
          event
        );
        addError(event);
      });

      provider.on('connection-close', (event: CloseEvent | null) => {
        log(
          7,
          'COLLAB',
          `provider.connection-close: ${config.ws_server} : ${id}`,
          event
        );
        if (event?.code === 3003) {
          addError(event);
        }
      });

      provider.on('sync', (state: boolean) => {
        log(7, 'COLLAB', `provider.sync: ${config.ws_server} : ${id}`, state);
        setState({ synced: state });
        if (state) {
          resetErrors();
        }
      });

      result.syncedPromise?.then((synced) => setState({ synced }));

      sharedTypes = new YjsSharedTypes(ydoc);
      sharedEditor = new YjsSharedEditor(ydoc.getMap(EDITORS_YTEXT_YMAP_KEY));
      awareness = new YjsAwareness(ydoc, provider, buildUserCss);
    } else {
      sharedTypes = new NoneSharedTypes();
      sharedEditor = new NoneSharedEditor();
      awareness = new NoneAwareness(config.simulateUsers);
      setState({ synced: true });
    }
    awareness.setUser(user);

    const extraContext = {};
    const loadChunks = compileChunks(collabChunks, extraContext, bep);
    const sharedData = loadChunks(sharedTypes);
    const localOverrider = new LocalOverrider(sharedData);

    setState({ built: true });

    // Return cleanup function
    return {
      sharedTypes,
      awareness,
      sharedData,
      localOverrider,
      sharedEditor,
      dispatcher,
      extraContext,
      cleanup: () => {
        if (provider) {
          provider.disconnect();
          provider.destroy();
        }
        if (awareness instanceof YjsAwareness) {
          // Remove all awareness listeners by destroying the awareness instance
          provider?.awareness?.destroy();
        }
        if (ydoc) {
          ydoc.destroy();
        }
      },
    };
  }, [config, user, collabChunks, id, addError, resetErrors]);

  // Add useEffect for cleanup
  useEffect(() => {
    return () => {
      if (context.cleanup) {
        log(7, 'COLLAB', 'cleanup');
        context.cleanup();
      }
    };
  }, []);

  //

  useHotkeys(
    'ctrl+shift+d',
    () => {
      console.log(
        'Shared Data Snapshot:',
        sharedDataToJson(context.sharedData)
      );
    },
    [context.sharedData]
  );

  return {
    state,
    context,
    connectionErrors,
  };
};

//
//

export const CollaborativeContextInternal = ({
  state,
  context,
  connectionErrors,
  children,
}: {
  state: TState;
  context: TCollaborationContext;
  connectionErrors: TConnectionError[];
  children: ReactNode;
}) => {
  log(7, 'COLLAB_INIT', 'CollaborativeContext update', {
    state: state,
    context,
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
      <collaborationContext.Provider value={context}>
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

export const CollaborativeContext = (props: CollaborativeContextProps) => {
  const { state, context, connectionErrors } =
    useCollaborativeContextInternal(props);
  return (
    <CollaborativeContextInternal
      state={state}
      context={context}
      connectionErrors={connectionErrors}
    >
      {props.children}
    </CollaborativeContextInternal>
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

export const useSharedData = <TSharedData extends TValidSharedData>(
  observe: Array<keyof TSharedData>,
  f: (data: TValidSharedDataToCopy<TSharedData>) => any
): ReturnType<typeof f> => {
  //
  const { localOverrider } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  const [, refresh] = useState({});

  const updateComponent = useCallback(() => refresh({}), []);

  useEffect(() => {
    localOverrider.observe(observe as string[], updateComponent);
    return () => {
      localOverrider.unobserve(observe as string[], updateComponent);
    };
  }, [localOverrider, observe, updateComponent]);

  return f(localOverrider.getData() as any);
};

//
//

export const useShareDataManager = <
  TSharedData extends TValidSharedData
>(): SharedDataManager<TSharedData> => {
  //
  const { localOverrider } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  return localOverrider as SharedDataManager<TSharedData>;
};

//
//

export const useDispatcher = <TE,>() => {
  const { dispatcher } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return dispatcher as FrontendDispatcher<TE | TCollabNativeEvent>;
};

//
//

export const useEventSequence = <
  TEvents extends TJsonObject,
  TSharedData extends TValidSharedData
>() => {
  const { dispatcher, localOverrider } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  const createEventSequence = useCallback(
    ({
      localReduce,
      localReduceUpdateKeys,
    }: {
      localReduce: LocalReduceFunction;
      localReduceUpdateKeys: Array<keyof TSharedData>;
    }) => {
      return new FrontendEventSequence<TEvents>(
        dispatcher,
        localReduce,
        localOverrider,
        localReduceUpdateKeys as string[]
      );
    },
    [dispatcher, localOverrider]
  );

  return { createEventSequence };
};

//
//

export const useExtraContext = <T,>() => {
  const { extraContext } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return extraContext as T;
};

//
//

export const useBindEditor = () => {
  const { awareness, sharedEditor } = useContext(
    collaborationContext
  ) as TCollaborationContext;

  return useCallback(
    (editorType: string, editorId: string, editorObject: any) => {
      bindEditor(awareness, sharedEditor, editorType, editorId, editorObject);
    },
    [awareness, sharedEditor]
  );
};
