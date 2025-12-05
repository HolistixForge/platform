// Initialize OpenTelemetry BEFORE any other imports
// This ensures auto-instrumentation works correctly
import { initializeBrowserObservability } from '@holistix-forge/observability/browser';
import { Logger } from '@holistix-forge/log';

import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app/app';

import '@holistix-forge/collab-engine/style';
import '@holistix-forge/ui-base/style';
import '@holistix-forge/ui-views/style';
import '@holistix-forge/user-containers/style';
import '@holistix-forge/notion/style';
import '@holistix-forge/airtable/style';
import '@holistix-forge/whiteboard/style';
import '@holistix-forge/tabs/style';
import '@holistix-forge/chats/style';
import '@holistix-forge/socials/style';
import '@holistix-forge/jupyter/style';
import '@holistix-forge/excalidraw/style';
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
