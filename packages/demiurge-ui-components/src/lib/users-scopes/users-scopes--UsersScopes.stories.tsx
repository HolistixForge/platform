import type { Meta, StoryObj } from '@storybook/react';
import { UsersScopes, UsersScopesProps } from './users-scopes';
import { useTestUsersScopes, scopes } from './test';

/**
 *
 */

const Wrap = (
  props: Pick<
    UsersScopesProps,
    'columnWidth' | 'avatarWidth' | 'scopes' | 'readonly'
  >,
) => {
  //
  const testLogic = useTestUsersScopes();

  return (
    <div style={{ padding: '100px' }}>
      <div style={{ height: '400px' }}>
        <UsersScopes {...props} {...testLogic} />
      </div>
    </div>
  );
};

/**
 *
 */

const meta: Meta<typeof Wrap> = {
  component: Wrap,
  title: 'Users/UserRights',
};
export default meta;
type Story = StoryObj<typeof Wrap>;

/**
 *
 */

export const Primary: Story = {
  args: {
    readonly: false,
    avatarWidth: 40,
    columnWidth: 250,
    scopes,
  },
};
