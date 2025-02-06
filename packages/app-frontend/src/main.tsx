import * as ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';

import { App } from './app/app';

import '@monorepo/ui-base/style';

const root = ReactDOM.createRoot(
  document.getElementById('root') as HTMLElement
);
root.render(
  <BrowserRouter>
    <App />
  </BrowserRouter>
);
