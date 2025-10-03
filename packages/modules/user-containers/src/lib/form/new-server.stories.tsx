import type { Meta, StoryObj } from '@storybook/react';

import { MockCollaborativeContext } from '@monorepo/collab-engine';
import { StoryApiContext } from '@monorepo/frontend-data';

import { NewServerForm } from './new-server';

//

const images = [
  {
    image_id: 0,
    image_name: 'image super bien',
    image_sha256: null,
    image_tag: 'ffa500',
  },
  {
    image_id: 1,
    image_name: 'mega lib 42',
    image_sha256: 'xxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx',
    image_tag: 'ffa500',
  },
];

const StoryWrapper = () => {
  return (
    <StoryApiContext
      ganymedeApiMock={(r) => {
        if (r.url === 'images') {
          return Promise.resolve({ _0: images });
        }
        throw new Error('Not implemented');
      }}
    >
      <MockCollaborativeContext
        frontChunks={[]}
        backChunks={[]}
        getRequestContext={() => ({})}
      >
        <NewServerForm
          viewId={''}
          position={{ x: 0, y: 0 }}
          closeForm={() => null}
        />
      </MockCollaborativeContext>
    </StoryApiContext>
  );
};

//

const meta = {
  title: 'Modules/Servers/Forms/NewServer',
  component: StoryWrapper,
  parameters: {
    layout: 'centered',
  },
  argTypes: {},
} satisfies Meta<typeof StoryWrapper>;

export default meta;

type Story = StoryObj<typeof StoryWrapper>;

export const Normal: Story = {
  args: {},
};
