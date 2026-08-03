import type { Preview } from '@storybook/react';
import { GlobalWrapper } from './global-wrapper';

// Union of the stylesheets the per-package previews imported individually.
// Each package exposes a `./style` export pointing at its built CSS, so these
// resolve the same way application code consumes them — which also means the
// packages must be built before the Storybook is.
import '@holistix-forge/ui-base/style';
import '@holistix-forge/ui-views/style';
import '@holistix-forge/whiteboard/style';
import '@holistix-forge/user-containers/style';

const preview: Preview = {
  parameters: {
    controls: {
      matchers: {
        color: /(background|color)$/i,
        date: /Date$/,
      },
    },
    backgrounds: {
      default: 'dark',
      values: [
        {
          name: 'dark',
          value: 'var(--color-bg-app)',
        },
      ],
    },
    options: {
      // Shared primitives first, feature modules after, rather than the
      // default alphabetical order.
      //
      // `Module` and `Modules` are both present because the packages disagree
      // on the prefix — chats/tabs/socials use the singular, notion and
      // whiteboard the plural. Listing both keeps them adjacent until the
      // titles are reconciled.
      storySort: {
        order: [
          'Basics',
          'Palette',
          'icons',
          'UI',
          'Forms',
          'Users',
          'internals',
          'Module',
          'Modules',
          'Mvp',
        ],
      },
    },
  },
  decorators: [GlobalWrapper],
  tags: [],
};

export default preview;
