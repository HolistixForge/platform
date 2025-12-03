// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeBrowserObservability } from '@holistix/observability/browser';
import { Logger } from '@holistix/log';

import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app/app';

import '@holistix/collab-engine/style';
import '@holistix/ui-base/style';
import '@holistix/ui-views/style';
import '@holistix/user-containers/style';
import '@holistix/notion/style';
import '@holistix/airtable/style';
import '@holistix/space/style';
import '@holistix/tabs/style';
import '@holistix/chats/style';
import '@holistix/socials/style';
import '@holistix/jupyter/style';
import '@holistix/excalidraw/style';
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
