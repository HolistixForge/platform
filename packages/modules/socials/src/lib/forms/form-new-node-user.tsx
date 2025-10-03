import React, { useEffect, useState } from 'react';
import {
  ButtonBase,
  TextFieldset,
  FormError,
  FormErrors,
  useAction,
  DialogControlled,
} from '@monorepo/ui-base';
import { useQueryUsersSearch } from '@monorepo/frontend-data';
import { UserListItem } from '@monorepo/ui-base';
import { TF_User } from '@monorepo/demiurge-types';
import { useDispatcher } from '@monorepo/collab-engine';
import { TEventSocials } from '../socials-events';
import { TPosition } from '@monorepo/core-graph';

//

export interface NewNodeUserFormData {
  userId: string;
}

export const NewNodeUserForm = ({
  viewId,
  position,
  closeForm,
}: {
  viewId: string;
  position: TPosition;
  closeForm: () => void;
}) => {
  const [search, setSearch] = useState('');
  const { data: users = [], isFetching } = useQueryUsersSearch(search);

  const dispatcher = useDispatcher<TEventSocials>();

  const action = useAction<NewNodeUserFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'socials:new-node-user',
        userId: d.userId,
        origin: {
          viewId: viewId,
          position,
        },
      });
    },
    [dispatcher, position, viewId],
    {
      startOpened: true,
      checkForm: (d, e) => {
        if (!d.userId) e.userId = 'Please select a user';
      },
    }
  );

  //

  useEffect(() => {
    if (!action.isOpened) {
      closeForm();
    }
  }, [action.isOpened]);

  //

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
    <DialogControlled
      title="Add User Node"
      description="Search and select a user to add as a node."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="userId" />
      <TextFieldset
        label="Search user"
        name="userSearch"
        onChange={handleInputChange}
        value={search}
        placeholder="Type a username..."
      />
      <FormErrors errors={action.errors} />
      <div
        style={
          {
            maxHeight: 250,
            overflowY: 'auto',
            marginTop: 10,
            '--avatar-width': '30px',
          } as any
        }
      >
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
    </DialogControlled>
  );
};
