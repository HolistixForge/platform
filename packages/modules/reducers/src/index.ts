import { TModule } from '@monorepo/module';

type TBaseEvent = { type: string };

export abstract class Reducer<TEvents = TBaseEvent, TDepsExports = unknown> {
  abstract reduce(e: TEvents, depsExports: TDepsExports): Promise<void>;
}

export type TReducersBackendExports = {
  reducers: Reducer[];
  loadReducers: (r: Reducer) => void;
};

export const moduleBackend: TModule<undefined, TReducersBackendExports> = {
  name: 'reducers',
  version: '0.0.1',
  description: 'Reducers module',
  dependencies: [],
  load: (args) => {
    const reducers: Reducer[] = [];
    args.moduleExports({
      reducers,
      loadReducers: (r: Reducer) => {
        reducers.push(r);
      },
    });
  },
};
