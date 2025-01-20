import type { Preview } from '@storybook/react';
import { GlobalWrapper } from './global-wrapper';

import '../src/lib/assets/css/index.scss';

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
          value: 'var(--color-background)',
        },
      ],
    },
  },
  decorators: [GlobalWrapper],
  tags: ['autodocs', 'autodocs', 'autodocs'],
};

export default preview;
