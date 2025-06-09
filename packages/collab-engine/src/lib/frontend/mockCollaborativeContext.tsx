import { ReactNode, useEffect, useMemo } from 'react';

import {
  JitterDispatcher,
  BackendEventProcessor,
  TCollaborativeChunk,
} from '@monorepo/collab-engine';
import { TJson, TJsonObject, TMyfetchRequest } from '@monorepo/simple-types';
import { ApiFetch } from '@monorepo/api-fetch';

import {
  CollaborativeContextInternal,
  TCollaborationContext,
  useCollaborativeContextInternal,
} from './context';

//

/**
 * a class that pretends to fetch an API but will just process the event locally in the browser
 */
class FakeApiFetch extends ApiFetch {
  private bep: BackendEventProcessor<TJsonObject, unknown>;

  constructor(bep: BackendEventProcessor<TJsonObject, unknown>) {
    super();
    this.bep = bep;
  }

  override async fetch(r: TMyfetchRequest): Promise<TJson> {
    await this.bep.process((r as any).jsonBody.event);
    return {};
  }
}

//
//

export const MockCollaborativeContext = ({
  children,
  frontChunks,
  backChunks,
  callback,
}: {
  children: ReactNode;
  frontChunks: TCollaborativeChunk[];
  backChunks: TCollaborativeChunk[];
  callback?: (context: TCollaborationContext) => void;
}) => {
  const { dispatcher, bep } = useMemo(() => {
    // create a new backend event processor to process events locally
    const bep = new BackendEventProcessor();
    // create a fake api fetch that passes events to the bep
    const fetch = new FakeApiFetch(bep);
    // create a jitter dispatcher to send events via the fake api fetch with random delays
    const dispatcher = new JitterDispatcher(fetch);
    return { bep, dispatcher };
  }, []);

  const config = useMemo(() => {
    return {
      collabChunks: frontChunks,
      id: 'story',
      config: { type: 'none', simulateUsers: true },
      dispatcher,
      user: {
        username: 'John Doe',
        color: '#ffa500',
      },
      bep,
    };
  }, [frontChunks, dispatcher, bep]);

  const { context, state, connectionErrors } = useCollaborativeContextInternal(
    config as any
  );

  // bind the shared types, editor, data, and extra context to the bep
  useEffect(() => {
    bep.bindData(
      context.sharedTypes,
      context.sharedEditor,
      context.sharedData,
      context.extraContext
    );
  }, []);

  useEffect(() => {
    callback?.(context);
  }, [callback, context]);

  return (
    <CollaborativeContextInternal
      state={state}
      context={context}
      connectionErrors={connectionErrors}
    >
      {children}
    </CollaborativeContextInternal>
  );
};
