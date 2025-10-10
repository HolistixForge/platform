/* eslint-disable @typescript-eslint/no-unused-vars */
import { Doc } from 'yjs';
import {
  createContext,
  useContext,
  useMemo,
  useState,
  useCallback,
  useEffect,
  ReactNode,
} from 'react';
import { useHotkeys } from 'react-hotkeys-hook';
import * as YWS from 'y-websocket';

import { log } from '@monorepo/log';

import {
  TValidSharedData,
  TAwarenessUser,
  SharedTypes,
  Awareness,
} from '../../index';

import { sharedDataToJson } from '../sharedData';
import { SharedEditor } from '../SharedEditor';

import './context.scss';

//
//
//

export type TYjsCollabConfig = {
  type: 'yjs';
  ws_server: string;
  token: {
    get: () => string;
    refresh: () => void;
  };
};
export type TNoneCollabConfig = { type: 'none'; simulateUsers?: boolean };
export type TCollabConfig = TNoneCollabConfig | TYjsCollabConfig;

//

export type TCollaborationContext = {
  sharedTypes: SharedTypes;
  sharedData: TValidSharedData;
  //localOverrider: LocalOverrider<TValidSharedData>;
  awareness: Awareness;
  //dispatcher: FrontendDispatcher<any>;
  sharedEditor: SharedEditor;
  cleanup: () => void;
};

//
//

const collaborationContext = createContext<TCollaborationContext | null>(null);

type CollaborativeContextProps = {
  children: ReactNode;
  id: string;
  config: TCollabConfig;
  // dispatcher: FrontendDispatcher<any>;
  user: TAwarenessUser;
  /** ONLY USE THIS IF YOU ARE USING A MOCK COLLABORATIVE CONTEXT */
  //bep?: BackendEventProcessor<any, any>;
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
  config,
  user,
  //dispatcher,
  onError,
}: //bep,
Omit<CollaborativeContextProps, 'children'>) => {
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

  const context = useMemo<any>(() => {
    log(7, 'COLLAB_INIT', 'collab context');

    let sharedTypes: SharedTypes;
    let awareness: Awareness;
    let provider: YWS.WebsocketProvider | undefined;
    let ydoc: Doc;
    let sharedEditor: SharedEditor | undefined;

    /*
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

      sharedTypes = new YjsSharedTypes(ydoc);
      sharedEditor = new YjsSharedEditor(ydoc.getMap(EDITORS_YTEXT_YMAP_KEY));
      awareness = new YjsAwareness(ydoc, provider, buildUserCss);
    } else {
      sharedTypes = new NoneSharedTypes(id);
      sharedEditor = new NoneSharedEditor();
      awareness = new NoneAwareness(config.simulateUsers);
      setState({ synced: true });
    }

    awareness.setUser(user);

    const { sharedData, extraContext } = compileChunks(
      collabChunks,
      sharedTypes,
      { dispatcher, bep }
    );

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
    */
  }, [config, user, id, addError, resetErrors]);

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

export const useSharedDataDirect = <TSharedData extends TValidSharedData>() => {
  const { sharedData } = useContext(
    collaborationContext
  ) as TCollaborationContext;
  return sharedData as TSharedData;
};
