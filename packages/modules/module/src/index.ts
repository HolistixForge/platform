import { log } from '@monorepo/log';

export type TModule<TRequired = object, TExports = object> = {
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
  modules: { module: TModule<never, object>; config: object }[]
) => {
  const depsExports: object = {};
  const loadedModules: string[] = [];
  for (let i = 0; i < modules.length; i++) {
    const m = modules[i];
    m.module.dependencies.forEach((d) => {
      if (!loadedModules.includes(d)) {
        throw new Error(
          `Module ${d} is not loaded, needed by [${m.module.name}]`
        );
      }
    });
    log(6, 'MODULES', `Loading module ${m.module.name}`);
    m.module.load({
      depsExports: depsExports as never,
      moduleExports: (e) => {
        Object.assign(depsExports, { [m.module.name]: e });
      },
      config: m.config,
    });
    loadedModules.push(m.module.name);
  }
  log(6, 'MODULES', `Loaded ${modules.length} modules`, { depsExports });
  return depsExports;
};
