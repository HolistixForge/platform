import { log } from '@monorepo/log';

export type TModule<TRequired = undefined, TExports = undefined> = {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  load: (args: {
    depsExports: TRequired;
    moduleExports: (e: TExports) => void;
    config: object;
  }) => void;
};

//

export const loadModules = (
  modules: { module: TModule<object, unknown>; config: object }[]
) => {
  const depsExports: object = {};
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    log(6, 'MODULES', `Loading module ${m.module.name}`);
    m.module.load({
      depsExports,
      moduleExports: (e) => {
        Object.assign(depsExports, { [m.module.name]: e });
      },
      config: m.config,
    });
  }
  log(6, 'MODULES', `Loaded ${modules.length} modules`, { depsExports });
  return depsExports;
};
