import { useState, useEffect, ReactNode, useMemo } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { EPriority, Logger } from '@holistix-forge/log';
import { StoryApiContext } from '@holistix-forge/frontend-data';
import { StoryDemiurgeSpace } from '@holistix-forge/space/stories';

//
import { loadModules, TModule } from '@holistix-forge/module';
import { ModuleProvider } from '@holistix-forge/module/frontend';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@holistix-forge/core-graph';
import { moduleBackend as collabBackend } from '@holistix-forge/collab';
import { moduleFrontend as collabFrontend } from '@holistix-forge/collab/frontend';
import {
  moduleBackend as reducersBackend,
  TReducersBackendExports,
} from '@holistix-forge/reducers';
import {
  moduleFrontend as reducersFrontend,
  linkDispatchToProcessEvent,
  TReducersFrontendExports,
} from '@holistix-forge/reducers/frontend';
import { moduleBackend as spaceBackend } from '@holistix-forge/space';
import { moduleFrontend as spaceFrontend } from '@holistix-forge/space/frontend';
//

import { moduleBackend as notionBackend } from '../..';
import { moduleFrontend as notionFrontend } from '../../frontend';

Logger.setPriority(EPriority.Debug);

// Proxy check wrapper component
const ProxyInstructions = ({ loading }: { loading?: boolean }) => (
  <div
    style={{
      display: 'flex',
      flexDirection: 'column',
      justifyContent: 'center',
      alignItems: 'center',
      height: '100vh',
      padding: '20px',
      fontFamily: 'monospace',
      backgroundColor: '#f5f5f5',
    }}
  >
    <div
      style={{
        backgroundColor: '#fff',
        border: '1px solid #ddd',
        borderRadius: '8px',
        padding: '30px',
        maxWidth: '600px',
        boxShadow: '0 2px 10px rgba(0,0,0,0.1)',
      }}
    >
      <h2 style={{ color: '#d32f2f', marginTop: 0 }}>
        <span role="img" aria-label="cross mark">
          ❌
        </span>{' '}
        Browser Proxy Not Running
      </h2>
      {loading && (
        <div
          style={{ color: '#1976d2', marginBottom: '16px', fontWeight: 500 }}
        >
          Checking if browser proxy is running...
        </div>
      )}
      <p style={{ color: '#666', lineHeight: '1.6' }}>
        The browser proxy server is required for this story to make API calls.
        Please start the proxy server first.
      </p>
      <div
        style={{
          backgroundColor: 'rgba(0,0,0,0.25)',
          border: '1px solid #e9ecef',
          borderRadius: '4px',
          padding: '15px',
          margin: '20px 0',
          fontFamily: 'monospace',
          fontSize: '14px',
        }}
      >
        <strong>Run this command in your terminal:</strong>
        <br />
        <code
          style={{
            backgroundColor: 'rgba(0,0,0,0.25)',
            padding: '8px 12px',
            borderRadius: '4px',
            display: 'inline-block',
            marginTop: '8px',
          }}
        >
          npx nx run browser-proxy-app:build
          <br />
          node ./packages/browser-proxy/browser-proxy-app/dist/main.js
        </code>
      </div>
      <p style={{ color: '#666', fontSize: '14px' }}>
        After starting the proxy, refresh this page to continue.
      </p>
    </div>
  </div>
);

const ProxyCheckWrapper = ({ children }: { children: ReactNode }) => {
  const [isProxyRunning, setIsProxyRunning] = useState<boolean | null>(null);
  const [isChecking, setIsChecking] = useState(true);

  useEffect(() => {
    const checkProxy = async () => {
      try {
        const response = await fetch('http://localhost:3001/proxy', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            method: 'GET',
            url: 'http://httpbin.org/get',
            headers: {},
            bodyType: 'none' as const,
          }),
        });

        setIsProxyRunning(response.ok);
        // eslint-disable-next-line @typescript-eslint/no-unused-vars
      } catch (error) {
        setIsProxyRunning(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkProxy();
  }, []);

  if (isChecking || !isProxyRunning) {
    return <ProxyInstructions loading={isChecking} />;
  }

  return children;
};

//

const collabConfig = {
  type: 'none',
  room_id: 'space-story',
  simulateUsers: true,
  user: { username: 'test', color: 'red' },
};

const modulesBackend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabBackend,
    config: collabConfig,
  },
  { module: reducersBackend, config: {} },
  { module: coreBackend, config: {} },
  {
    module: {
      name: 'gateway',
      version: '0.0.1',
      description: 'Gateway module',
      dependencies: ['collab', 'reducers'],
      load: () => {
        //
      },
    },
    config: {},
  },
  { module: spaceBackend, config: {} },
  { module: notionBackend, config: {} },
];

const modulesFrontend: { module: TModule<never, object>; config: object }[] = [
  {
    module: collabFrontend,
    config: collabConfig,
  },
  { module: reducersFrontend, config: {} },
  { module: coreFrontend, config: {} },
  { module: spaceFrontend, config: {} },
  { module: notionFrontend, config: {} },
];

//

const Story = () => {
  const { frontendModules } = useMemo(() => {
    const backendModules = loadModules(modulesBackend);
    const frontendModules = loadModules(modulesFrontend);

    linkDispatchToProcessEvent(
      backendModules as { reducers: TReducersBackendExports },
      frontendModules as { reducers: TReducersFrontendExports }
    );

    return { backendModules, frontendModules };
  }, []);

  return (
    <ProxyCheckWrapper>
      <StoryApiContext>
        <ModuleProvider exports={frontendModules}>
          <div style={{ height: '100vh', width: '100vw' }}>
            <StoryDemiurgeSpace />
          </div>
        </ModuleProvider>
      </StoryApiContext>
    </ProxyCheckWrapper>
  );
};

//

//

const meta = {
  title: 'Modules/Notion/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

export const Default: StoryObj<typeof Story> = {
  args: {},
};
