import React, { useState } from 'react';
import {
  TAction,
  ButtonBase,
  TextFieldset,
  FormError,
  FormErrors,
} from '@monorepo/ui-base';
import { useQueryUsersSearch } from '@monorepo/frontend-data';
import { UserListItem } from '@monorepo/ui-base';
import { TF_User } from '@monorepo/demiurge-types';

export interface NewNodeUserFormData {
  userId: string;
}

export const NewNodeUserForm = ({
  action,
}: {
  action: TAction<NewNodeUserFormData>;
}) => {
  const [search, setSearch] = useState('');
  const { data: users = [], isFetching } = useQueryUsersSearch(search);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearch(e.target.value);
  };

  const handleUserSelect = (user: TF_User) => {
    action.handleInputChange({
      target: { name: 'userId', value: user.user_id },
    } as any);
    action.callback({ userId: user.user_id });
  };

  return (
    <>
      <FormError errors={action.errors} id="userId" />
      <TextFieldset
        label="Search user"
        name="userSearch"
        onChange={handleInputChange}
        value={search}
        placeholder="Type a username..."
      />
      <FormErrors errors={action.errors} />
      <div style={{ maxHeight: 250, overflowY: 'auto', marginTop: 10 }}>
        {isFetching && <div>Loading...</div>}
        {users.map((user: TF_User) => (
          <UserListItem
            key={user.user_id}
            collaborator={{ ...user, scope: [], is_owner: false }}
            onClick={() => handleUserSelect(user)}
          />
        ))}
        {!isFetching && users.length === 0 && search && (
          <div>No users found.</div>
        )}
      </div>
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Add User Node"
          loading={action.loading}
          disabled={!action.formData.userId}
        />
      </div>
    </>
  );
};
