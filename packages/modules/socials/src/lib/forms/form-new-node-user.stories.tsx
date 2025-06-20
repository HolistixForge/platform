import type { Meta, StoryObj } from '@storybook/react';

import { NewNodeUserForm } from './form-new-node-user';
import { MockCollaborativeContext } from '@monorepo/collab-engine';
import { StoryApiContext } from '@monorepo/frontend-data';
import { randomGuys } from '@monorepo/ui-base';

//

const StoryWrapper = () => {
  return (
    <StoryApiContext
      ganymedeApiMock={(r) => {
        console.log({ r });
        if (r.method === 'GET' && r.url.includes('users-search')) {
          return Promise.resolve({
            _0: randomGuys,
          });
        }
        throw new Error('Not implemented');
      }}
    >
      <MockCollaborativeContext
        frontChunks={[]}
        backChunks={[]}
        getRequestContext={() => ({})}
      >
        <NewNodeUserForm
          viewId={''}
          position={{ x: 0, y: 0 }}
          closeForm={() => {}}
        />
      </MockCollaborativeContext>
    </StoryApiContext>
  );
};

//

const meta = {
  title: 'Modules/Socials/Forms/NewNodeUser',
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
