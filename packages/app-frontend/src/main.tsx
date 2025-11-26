// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeBrowserObservability } from '@monorepo/observability';
import { Logger } from '@monorepo/log';

import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app/app';

import '@monorepo/collab-engine/style';
import '@monorepo/ui-base/style';
import '@monorepo/ui-views/style';
import '@monorepo/user-containers/style';
import '@monorepo/notion/style';
import '@monorepo/airtable/style';
import '@monorepo/space/style';
import '@monorepo/tabs/style';
import '@monorepo/chats/style';
import '@monorepo/socials/style';
import '@monorepo/jupyter/style';
import '@monorepo/excalidraw/style';
import './index.scss';

// Initialize observability for browser
const otlpEndpoint =
  typeof window !== 'undefined' && (window as any).OTLP_ENDPOINT_HTTP
    ? (window as any).OTLP_ENDPOINT_HTTP
    : 'http://localhost:4318';

initializeBrowserObservability({
  serviceName: 'frontend',
  environment:
    typeof window !== 'undefined' && (window as any).OTEL_DEPLOYMENT_ENVIRONMENT
      ? (window as any).OTEL_DEPLOYMENT_ENVIRONMENT
      : import.meta.env.VITE_ENVIRONMENT || 'development',
});

// Initialize Logger for browser
// Note: Logger.initialize() will detect browser environment and skip OTLP setup
// Logs will still work with trace context extraction from active spans
Logger.initialize({
  otlpEndpointHttp: otlpEndpoint,
  serviceName: 'frontend',
});

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
