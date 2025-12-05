import type { Preview } from '@storybook/react';
import { GlobalWrapper } from './global-wrapper';

import '@holistix-forge/ui-base/style';
import '@holistix-forge/whiteboard/style';
// import '../src/lib/index.scss';

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
