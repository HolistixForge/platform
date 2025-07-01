import { useState, useEffect, ReactNode } from 'react';
import type { Meta, StoryObj } from '@storybook/react';

import { Logger } from '@monorepo/log';
import { MockCollaborativeContext } from '@monorepo/collab-engine';
import {
  moduleBackend as coreBackend,
  moduleFrontend as coreFrontend,
} from '@monorepo/core';
import { StoryApiContext } from '@monorepo/frontend-data';
import { TSpaceMenuEntries, TSpaceMenuEntry } from '@monorepo/module/frontend';
import { moduleBackend as spaceBackend } from '@monorepo/space';
import { moduleFrontend as spaceFrontend } from '@monorepo/space/frontend';
import { StoryHolistixSpace } from '@monorepo/space/stories';
import type { ModuleBackend } from '@monorepo/module';

Logger.setPriority(7);

// Proxy check wrapper component
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
      } catch (error) {
        setIsProxyRunning(false);
      } finally {
        setIsChecking(false);
      }
    };

    checkProxy();
  }, []);

  if (isChecking) {
    return (
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          height: '100vh',
          fontSize: '16px',
          color: '#666',
        }}
      >
        Checking if browser proxy is running...
      </div>
    );
  }

  if (!isProxyRunning) {
    return (
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
            ❌ Browser Proxy Not Running
          </h2>
          <p style={{ color: '#666', lineHeight: '1.6' }}>
            The browser proxy server is required for this story to make API
            calls. Please start the proxy server first.
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
  }

  return <>{children}</>;
};

//

const modulesBackend: ModuleBackend[] = [
  { collabChunk: { name: 'gateway' } },
  coreBackend,
  spaceBackend,
  {
    collabChunk: {
      name: 'config',
      loadExtraContext: () => ({
        config: {
          AIRTABLE_API_KEY:
            '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',
        },
      }),
    },
  },
];

const modulesFrontend = [coreFrontend, spaceFrontend];

//

const nodeTypes = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.nodes };
}, {});

//

const spaceMenuEntries: TSpaceMenuEntries = (args) => {
  console.log('spaceMenuEntries', args);
  return modulesFrontend.reduce((acc, module) => {
    return [...acc, ...module.spaceMenuEntries(args)];
  }, [] as TSpaceMenuEntry[]);
};

//

const panelsDefs = modulesFrontend.reduce((acc, module) => {
  return { ...acc, ...module.panels };
}, {});

//

const Story = () => {
  //

  return (
    <ProxyCheckWrapper>
      <StoryApiContext>
        <MockCollaborativeContext
          frontChunks={modulesFrontend.map((m) => m.collabChunk)}
          backChunks={modulesBackend.map((m) => m.collabChunk)}
          getRequestContext={() => ({})}
        >
          <div style={{ height: '100vh', width: '100vw' }}>
            <StoryHolistixSpace
              nodeTypes={nodeTypes}
              spaceMenuEntries={spaceMenuEntries}
              panelsDefs={panelsDefs}
            />
          </div>
        </MockCollaborativeContext>
      </StoryApiContext>
    </ProxyCheckWrapper>
  );
};

//

//

const meta = {
  title: 'Modules/Airtable/Main',
  component: Story,
  parameters: {
    layout: 'fullscreen',
  },
  argTypes: {},
} satisfies Meta<typeof Story>;

export default meta;

type Story = StoryObj<typeof Story>;

export const Default: Story = {
  args: {},
};
