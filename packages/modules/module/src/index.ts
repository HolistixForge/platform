export type TModule<TRequired = undefined, TExports = undefined> = {
  name: string;
  version: string;
  description: string;
  dependencies: string[];
  load: (args: {
    depsExports: TRequired;
    moduleExports: (e: TExports) => void;
  }) => void;
};
