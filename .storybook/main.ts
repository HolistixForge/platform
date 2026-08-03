import type { StorybookConfig } from '@storybook/react-vite';

/**
 * Workspace-wide Storybook.
 *
 * One build covering every package, with the sidebar grouped by the `title`
 * each story declares (`Modules/Notion/Main`, `Basics/Buttons`, ...) — rather
 * than one Storybook per package, which fragments the component library across
 * a dozen URLs and makes cross-package comparison impossible.
 *
 * The per-package `.storybook/` directories are kept so `nx run <pkg>:storybook`
 * still works for focused development on a single package.
 */
const config: StorybookConfig = {
  stories: [
    '../packages/*/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
    '../packages/modules/*/src/**/*.@(mdx|stories.@(js|jsx|ts|tsx))',
  ],

  addons: ['@storybook/addon-essentials', '@storybook/addon-interactions'],

  framework: {
    name: '@storybook/react-vite',
    options: {
      builder: {
        viteConfigPath: '.storybook/vite.config.ts',
      },
    },
  },

  core: {
    disableTelemetry: true,
  },
};

export default config;
