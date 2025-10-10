import { createContext, useContext } from 'react';

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
  return (
    <moduleContext.Provider value={{ exports }}>
      {children}
    </moduleContext.Provider>
  );
};

export const useModuleExports = <T extends object>() => {
  const context = useContext(moduleContext);
  return context.exports as T;
};
