import { createContext, useContext, useMemo } from 'react';

export const moduleContext = createContext<{ exports: object }>({
  exports: {},
});

export const ModuleProvider = ({
  children,
  exports,
}: {
  children: React.ReactNode;
  exports: object;
}) => {
  const contextValue = useMemo(() => ({ exports }), [exports]);

  return (
    <moduleContext.Provider value={contextValue}>
      {children}
    </moduleContext.Provider>
  );
};

export const useModuleExports = <T extends object>(from?: string) => {
  const context = useContext(moduleContext);
  return context.exports as Readonly<T>;
};
