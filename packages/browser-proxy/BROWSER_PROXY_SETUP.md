# Universal Browser Proxy Setup

This guide explains how to use the universal browser proxy to run backend code in browser environments without CORS issues.

## Overview

The universal browser proxy consists of:

1. **Node.js Proxy Server** - Forwards HTTP requests to external APIs
2. **Browser Proxy Fetch** - Intercepts fetch requests in the browser
3. **React Context Provider** - Easy integration with React applications

## Quick Start

### 1. Start the Proxy Server

```bash
# From the monorepo root
cd packages/collab-engine
npm run build  # Build the TypeScript files
node start-proxy.js
```

Or set a custom port:

```bash
PROXY_PORT=3002 node start-proxy.js
```

### 2. Use in Your Stories

```tsx
import { BrowserProxyProvider } from '@monorepo/collab-engine';

const Story = () => {
  return (
    <BrowserProxyProvider proxyUrl="http://localhost:3001">
      <YourStoryComponent />
    </BrowserProxyProvider>
  );
};
```

### 3. Your Backend Code Works Automatically

Any HTTP request made in the browser will be automatically proxied:

```typescript
// This will work in browser environments without CORS issues
const notion = new Client({ auth: 'your-api-key' });
await notion.databases.retrieve({ database_id: 'your-db-id' });

// Or any other API
const response = await fetch('https://api.external-service.com/data');
```

## How It Works

### Browser Detection

The proxy automatically detects when it's running in a browser environment and only proxies external requests.

### Request Flow

1. Browser makes HTTP request to external API
2. `BrowserProxyFetch` intercepts the request
3. Request is sent to local proxy server (`http://localhost:3001/proxy`)
4. Proxy server forwards request to external API
5. Response is returned to browser

### CORS Handling

The proxy server automatically adds CORS headers to allow browser requests.

## Configuration Options

### BrowserProxyProvider Props

```tsx
<BrowserProxyProvider
  proxyUrl="http://localhost:3001" // Proxy server URL
  enabled={true} // Enable/disable proxy
  autoPolyfill={true} // Auto-polyfill global fetch
>
  {children}
</BrowserProxyProvider>
```

### Manual Configuration

```typescript
import { browserProxyFetch } from '@monorepo/collab-engine';

// Configure manually
browserProxyFetch.setProxyUrl('http://localhost:3001');
browserProxyFetch.setEnabled(true);

// Polyfill global fetch
import { polyfillGlobalFetch } from '@monorepo/collab-engine';
polyfillGlobalFetch();
```

## Integration Patterns

### 1. With Existing Story Contexts

```tsx
import { BrowserProxyProvider } from '@monorepo/collab-engine';
import { StoryApiContext } from '@monorepo/frontend-data';

const Story = () => (
  <BrowserProxyProvider>
    <StoryApiContext>
      <MockCollaborativeContext>
        <YourStoryComponent />
      </MockCollaborativeContext>
    </StoryApiContext>
  </BrowserProxyProvider>
);
```

### 2. Higher-Order Component

```tsx
import { withBrowserProxy } from '@monorepo/collab-engine';

const EnhancedStory = withBrowserProxy(
  YourStoryComponent,
  'http://localhost:3001'
);
```

### 3. Hook Usage

```tsx
import { useBrowserProxy } from '@monorepo/collab-engine';

const MyComponent = () => {
  const { proxyUrl, isEnabled, setEnabled } = useBrowserProxy();

  return (
    <div>
      <p>Proxy: {proxyUrl}</p>
      <p>Enabled: {isEnabled ? 'Yes' : 'No'}</p>
      <button onClick={() => setEnabled(!isEnabled)}>Toggle Proxy</button>
    </div>
  );
};
```

## Troubleshooting

### Proxy Server Won't Start

```bash
# Check if port is in use
lsof -i :3001

# Use different port
PROXY_PORT=3002 node start-proxy.js
```
