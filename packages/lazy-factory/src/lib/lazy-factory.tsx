import { lazy, LazyExoticComponent, useState, useMemo } from 'react';
import { ErrorComponent, withFactoryError } from './ErrorComponent';
import { initLibrary } from './init';
import { EComponentMode, TFactoryComponent, TLibrary } from './types';

type T_Hoc = (wc: TFactoryComponent) => TFactoryComponent;

//
//

const withMode = (
  WrappedComponent: TFactoryComponent,
  mode: EComponentMode
) => {
  return (props: object) => {
    return <WrappedComponent {...props} mode={mode} />;
  };
};

//
//

type T_Libraries = {
  [key: string]: Promise<TLibrary>;
};

//
type T_LibrariesIndex = {
  [key: string]: () => Promise<TLibrary>;
};

//
//

class ComponentFactory {
  _librariesIndex: T_LibrariesIndex = {};
  _libraries: T_Libraries = {};

  //

  setLibraries = (l: T_LibrariesIndex) => {
    this._librariesIndex = l;
  };

  //

  getComponent = (
    type: string,
    acceptedMode: Array<EComponentMode>,
    Hoc: T_Hoc | null
  ): Promise<{ Component: TFactoryComponent; mode: EComponentMode }> => {
    const [libraryName = null, componentName = null] = type.split(':');

    if (!libraryName)
      return Promise.reject(new Error(`Invalid component type [${type}]`));

    if (!this._librariesIndex[libraryName])
      return Promise.reject(
        new Error(`No such components library (yet ?) [${libraryName}]`)
      );

    if (!this._libraries[libraryName]) {
      this._libraries[libraryName] = this._librariesIndex[libraryName]().then(
        (l) => initLibrary(l)
      );
    }

    const promise = this._libraries[libraryName].then((lib: TLibrary) => {
      if (!componentName) throw new Error(`invalid component id: [${type}]`);

      const component = lib.components.find((c) => c.name === componentName);
      if (!component)
        throw new Error(
          `lib [${libraryName}] does not expose component [${componentName}]`
        );

      for (const mode of acceptedMode) {
        if (component[mode]) {
          let Component = component[mode] as TFactoryComponent;
          if (Hoc) Component = Hoc(Component);
          Component = withMode(Component, mode);
          return {
            Component,
            mode,
          };
        }
      }

      throw new Error(
        `component [${componentName}] from lib [${libraryName}] does not exist for any mode of [${acceptedMode.join(
          ', '
        )}]`
      );
    });

    return promise;
  };
}

//
//

const _componentFactory_ = new ComponentFactory();

//
//

export const useFactory = (
  type: string,
  acceptedMode: Array<EComponentMode>,
  Hoc: T_Hoc | null
): {
  Component: LazyExoticComponent<TFactoryComponent>;
  mode: EComponentMode | null;
} => {
  const [mode, setMode] = useState<EComponentMode | null>(null);

  const LazyComponent = useMemo<LazyExoticComponent<TFactoryComponent>>(() => {
    const promise = _componentFactory_.getComponent(type, acceptedMode, Hoc);

    promise.then(({ mode: m }) => setMode(m));

    // we return a React.lazy() wrapped Component
    // lazy() accept a Promise that resolve as a module which default export is a React Component
    // we just fake it returning an object with a "default" property
    // (We should match the returning type of import(...) which lazy is designed to be used with)

    return lazy(() =>
      promise
        .then(({ Component, mode }) => ({ default: Component }))
        .catch((e) => {
          const FactoryErrorComponent = withFactoryError(
            ErrorComponent,
            acceptedMode,
            e
          );
          return {
            default: Hoc ? Hoc(FactoryErrorComponent) : FactoryErrorComponent,
          };
        })
    );

    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type, Hoc, acceptedMode.join(',')]);

  return {
    Component: LazyComponent,
    mode,
  };
};

//
//

export default _componentFactory_;
