import type { Preview } from '@storybook/react';
import { GlobalWrapper } from './global-wrapper';

import '@holistix/ui-base/style';
import '@holistix/space/style';

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
  tags: [],
};

export default preview;
