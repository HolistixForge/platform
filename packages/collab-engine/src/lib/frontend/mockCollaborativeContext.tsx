import { ReactNode, useEffect, useMemo, useState } from 'react';

import {
  JitterDispatcher,
  BackendEventProcessor,
  TCollaborativeChunk,
  compileChunks,
  NoneSharedTypes,
} from '@monorepo/collab-engine';
import { TJson, TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { ApiFetch } from '@monorepo/api-fetch';

import {
  CollaborativeContextInternal,
  TCollaborationContext,
  useCollaborativeContextInternal,
} from './context';
import { NoneSharedEditor } from '../SharedEditor';

//

/**
 * a class that pretends to fetch an API but will just process the event locally in the browser
 */
class FakeApiFetch extends ApiFetch {
  private bep: BackendEventProcessor<TJsonObject, unknown>;
  private getRequestContext: (event: TJsonObject) => TJsonObject;

  constructor(
    bep: BackendEventProcessor<TJsonObject, unknown>,
    getRequestContext: (event: TJsonObject) => TJsonObject
  ) {
    super();
    this.bep = bep;
    this.getRequestContext = getRequestContext;
  }

  override async fetch(r: TMyfetchRequest): Promise<TJson> {
    const requestContext = this.getRequestContext((r as any).jsonBody.event);
    await this.bep.process((r as any).jsonBody.event, requestContext);
    return {};
  }
}

//
//

const MOCK_ROOM_ID = 'story';

//

export const MockCollaborativeContext = ({
  children,
  frontChunks,
  backChunks,
  callback,
  getRequestContext,
}: {
  children: ReactNode;
  frontChunks: TCollaborativeChunk[];
  backChunks: TCollaborativeChunk[];
  getRequestContext: (event: TJsonObject) => TJsonObject;
  callback?: (context: TCollaborationContext) => void;
}) => {
  //
  // backend part and bridge dispatcher
  const { dispatcher } = useMemo(() => {
    // create a new backend event processor to process events locally
    const bep = new BackendEventProcessor();
    // create a fake api fetch that passes events to the bep
    const fetch = new FakeApiFetch(bep, getRequestContext);
    // create a jitter dispatcher to send events via the fake api fetch with random delays
    const dispatcher = new JitterDispatcher(fetch);

    const nst = new NoneSharedTypes(MOCK_ROOM_ID);
    const nse = new NoneSharedEditor();

    const { sharedData, extraContext } = compileChunks(backChunks, nst, {
      bep,
    });

    bep.bindData(nst, nse, sharedData, {}, extraContext);

    return { dispatcher };
  }, [backChunks]);

  //
  // frontend part
  const config = useMemo(() => {
    return {
      collabChunks: frontChunks,
      id: MOCK_ROOM_ID,
      config: { type: 'none', simulateUsers: true },
      dispatcher,
      user: {
        username: 'John Doe',
        color: '#ffa500',
      },
    };
  }, [frontChunks, dispatcher]);
  const { context, state, connectionErrors } = useCollaborativeContextInternal(
    config as any
  );

  const [ready, setReady] = useState(callback ? false : true);

  useEffect(() => {
    console.log('MockCollaborativeContext: run callback', context);
    callback?.(context);
    setReady(true);
  }, [callback, context]);

  return (
    <CollaborativeContextInternal
      state={state}
      context={context}
      connectionErrors={connectionErrors}
    >
      {ready ? children : <div>Loading...</div>}
    </CollaborativeContextInternal>
  );
};
