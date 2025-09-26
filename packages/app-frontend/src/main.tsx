import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app/app';

import '@monorepo/collab-engine/style';
import '@monorepo/ui-base/style';
import '@monorepo/ui-views/style';
import '@monorepo/servers/style';
import '@monorepo/notion/style';
import '@monorepo/airtable/style';
import '@monorepo/space/style';
import '@monorepo/tabs/style';
import '@monorepo/chats/style';
import '@monorepo/socials/style';
import '@monorepo/jupyter/style';
import '@monorepo/excalidraw/style';
import './index.scss';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
