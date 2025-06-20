import React, { createContext, useContext, useEffect, ReactNode } from 'react';
import { browserProxyFetch, polyfillGlobalFetch } from './browser-proxy-fetch';

interface BrowserProxyContextValue {
  proxyUrl: string;
  isEnabled: boolean;
  setEnabled: (enabled: boolean) => void;
  setProxyUrl: (url: string) => void;
}

const BrowserProxyContext = createContext<BrowserProxyContextValue | null>(
  null
);

interface BrowserProxyProviderProps {
  children: ReactNode;
  proxyUrl?: string;
  enabled?: boolean;
  autoPolyfill?: boolean;
}

/**
 * Provider component that sets up browser proxy functionality
 */
export const BrowserProxyProvider: React.FC<BrowserProxyProviderProps> = ({
  children,
  proxyUrl = 'http://localhost:3001',
  enabled = true,
  autoPolyfill = true,
}) => {
  useEffect(() => {
    // Configure the proxy
    browserProxyFetch.setProxyUrl(proxyUrl);
    browserProxyFetch.setEnabled(enabled);

    // Optionally polyfill global fetch
    if (autoPolyfill && enabled) {
      polyfillGlobalFetch();
      console.log('🔧 Browser proxy enabled with global fetch polyfill');
    }

    if (enabled) {
      console.log(`📡 Browser proxy configured for: ${proxyUrl}`);
    }
  }, [proxyUrl, enabled, autoPolyfill]);

  const contextValue: BrowserProxyContextValue = {
    proxyUrl,
    isEnabled: enabled,
    setEnabled: (enabled: boolean) => {
      browserProxyFetch.setEnabled(enabled);
    },
    setProxyUrl: (url: string) => {
      browserProxyFetch.setProxyUrl(url);
    },
  };

  return (
    <BrowserProxyContext.Provider value={contextValue}>
      {children}
    </BrowserProxyContext.Provider>
  );
};

/**
 * Hook to access browser proxy context
 */
export const useBrowserProxy = (): BrowserProxyContextValue => {
  const context = useContext(BrowserProxyContext);
  if (!context) {
    throw new Error(
      'useBrowserProxy must be used within a BrowserProxyProvider'
    );
  }
  return context;
};

/**
 * Higher-order component for easy integration with existing contexts
 */
export const withBrowserProxy = <P extends object>(
  Component: React.ComponentType<P>,
  proxyUrl?: string,
  enabled?: boolean
) => {
  const WrappedComponent: React.FC<P> = (props) => (
    <BrowserProxyProvider proxyUrl={proxyUrl} enabled={enabled}>
      <Component {...props} />
    </BrowserProxyProvider>
  );

  WrappedComponent.displayName = `withBrowserProxy(${
    Component.displayName || Component.name
  })`;
  return WrappedComponent;
};
