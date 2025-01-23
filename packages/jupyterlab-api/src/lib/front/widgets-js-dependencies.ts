import { insertScriptsSynchronously } from '@monorepo/ui-toolkit';

//
//
//

export const injectWidgetsScripts = (baseUrl: string) => {
  const ss = scripts(baseUrl);
  return insertScriptsSynchronously(ss);
};

//
//
//

const scripts = (baseUrl: string) => [
  {
    // Load RequireJS, used by the IPywidgets for dependency management
    // TODO: integrity="sha256-Ae2Vz/4ePdIu6ZyI/5ZGsYnb+m0JlOmKPjt6XZ9JJkA=" crossorigin="anonymous"
    // TODO: hard coded version ?
    url: 'https://cdnjs.cloudflare.com/ajax/libs/require.js/2.3.4/require.min.js',
    async: true,
  },
  {
    code: `
              requirejs.config({
                  paths: {
                      'jupyter-matplotlib': '${baseUrl}/nbextensions/jupyter-matplotlib/index'
                  }
              });`,
    async: true,
  },
  {
    // Load IPywidgets bundle for embedding
    // TODO: data-jupyter-widgets-cdn="https://unpkg.com/" data-jupyter-widgets-cdn-only
    url: 'https://cdn.jsdelivr.net/npm/@jupyter-widgets/html-manager@*/dist/embed-amd.js',
    async: true,
  },
];
