import type { Meta, StoryObj } from '@storybook/react';

import { StoryApiContext } from '@monorepo/frontend-data';
import { randomGuys } from '@monorepo/ui-base';
import { ModuleProvider } from '@monorepo/module/frontend';

import { NewNodeUserForm } from './form-new-node-user';

//

const fakeFrontendModules = {
  reducers: {
    dispatcher: {
      dispatch: () => {
        /**/
      },
    },
  },
};

const StoryWrapper = () => {
  return (
    <ModuleProvider exports={fakeFrontendModules}>
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
        <NewNodeUserForm
          viewId={''}
          position={{ x: 0, y: 0 }}
          closeForm={() => {
            /**/
          }}
        />
      </StoryApiContext>
    </ModuleProvider>
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
