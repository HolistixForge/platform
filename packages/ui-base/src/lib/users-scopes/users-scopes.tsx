import * as Sa from '@radix-ui/react-scroll-area';
import * as Checkbox from '@radix-ui/react-checkbox';
import {
  CheckIcon,
  MagnifyingGlassIcon,
  PlusIcon,
  TrashIcon,
  UpdateIcon,
} from '@radix-ui/react-icons';
import React, { CSSProperties, ReactNode, useCallback, useState } from 'react';
import { ButtonIcon } from '../buttons/buttonIcon';
import { UserInline } from '../users/users';
import { TextFieldset } from '../form/form-fields/text-fieldset';
import { useAction } from '../buttons/useAction';
import { ButtonBase } from '../buttons/buttonBase';
import { TCollaborator, TF_User } from '@holistix/demiurge-types';

import './users-scopes.scss';

export type UsersScopesLogicProps = {
  collaborators: TCollaborator[];
  collaboratorsLoading: boolean;
  searchResults: TF_User[];
  //
  onDelete: (u: TF_User) => Promise<void>;
  onSearch: (s: string) => void;
  searchLoading: boolean;
  onValidateUser: (u: TCollaborator) => Promise<void>;
};

/**
 *
 */

export type UsersScopesProps = {
  readonly?: boolean;
  columnWidth: number;
  avatarWidth: number;
  scopes: { [k: string]: { title: string } };
} & UsersScopesLogicProps;

//

export const UsersScopes = ({
  readonly,
  collaborators,
  collaboratorsLoading,
  searchResults,
  onDelete,
  onSearch,
  searchLoading,
  onValidateUser,
  columnWidth,
  avatarWidth,
  scopes,
}: UsersScopesProps) => {
  //
  const [searchPanelOpened, setSearchPanelOpened] = useState(false);
  const [editedUser, setEditedUser] = useState<TCollaborator | null>(null);
  const [searchValue, setSearchValue] = useState('');
  const [loading, setLoading] = useState({
    /** array of user_id pending deletion */
    delete: [] as string[],
  });

  //

  const onDeleteCollaboratorClicked = useCallback(
    (u: TF_User, e?: React.MouseEvent) => {
      setEditedUser(null);
      e?.stopPropagation();
      setLoading((l) => {
        l.delete.push(u.user_id);
        return { ...l };
      });
      return onDelete(u).then(() =>
        setLoading((l) => {
          l.delete = l.delete.filter((o) => o !== u.user_id);
          return { ...l };
        }),
      );
    },
    [onDelete],
  );

  //

  const onAddUserClicked = () => {
    setSearchPanelOpened(true);
    setEditedUser(null);
  };

  //

  const onCollaboratorClicked = (u: TF_User) => {
    setSearchPanelOpened(false);
    onSearchedUserClicked(u);
  };

  //

  const userToCollaborator = (user: TF_User): TCollaborator => {
    // if a collaborator yet, get the current user's scopes
    const yet = collaborators.find((c) => c.user_id === user.user_id);
    if (yet) return { ...yet };
    else return { ...user, scope: [], is_owner: false };
  };

  //

  const onSearchedUserClicked = (u: TF_User) => {
    setEditedUser(userToCollaborator(u));
  };

  //

  const onSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const v = e.target.value;
    setSearchValue(v);
    onSearch(v);
  };

  //

  const validateAction = useAction(async () => {
    if (editedUser) {
      if (editedUser.scope.length === 0)
        await onDeleteCollaboratorClicked(editedUser);
      else await onValidateUser(editedUser);
    }
    setEditedUser(null);
    setSearchPanelOpened(false);
  }, [editedUser, onDeleteCollaboratorClicked, onValidateUser]);

  //

  const onScopeChange = (scope: string, state: boolean) => {
    const c = { ...(editedUser as TCollaborator) };
    c.scope = c.scope.filter((s) => s !== scope);
    if (state) c.scope.push(scope);
    setEditedUser(c);
  };

  const all = () => {
    const c = { ...(editedUser as TCollaborator) };
    c.scope = Object.keys(scopes).map((s) => s);
    setEditedUser(c);
  };

  const none = () => {
    const c = { ...(editedUser as TCollaborator) };
    c.scope = [];
    setEditedUser(c);
  };

  //

  return (
    <div
      className="users-scopes"
      style={
        {
          '--column-width': `${columnWidth}px`,
          '--avatar-width': `${avatarWidth}px`,
        } as CSSProperties
      }
    >
      <div className="panel-collaborators">
        <span className="panel-title">Collaborators</span>
        {!readonly && (
          <ButtonIcon
            Icon={PlusIcon}
            callback={onAddUserClicked}
            className="blue"
            style={{
              float: 'right',
              marginTop: '7px',
            }}
          />
        )}
        <ScrollArea>
          <div style={{ textAlign: 'center' }}>
            {collaboratorsLoading && (
              <ButtonIcon loading={collaboratorsLoading} />
            )}
          </div>
          {collaborators.map((u) => {
            const wait = loading.delete.includes(u.user_id);
            return (
              <UserListItem
                key={u.user_id}
                collaborator={u}
                onClick={!wait ? onCollaboratorClicked : undefined}
              >
                {!readonly && !u.is_owner && (
                  <ButtonIcon
                    className="red"
                    Icon={TrashIcon}
                    loading={wait}
                    callback={(e) => onDeleteCollaboratorClicked(u, e)}
                  />
                )}
              </UserListItem>
            );
          })}
        </ScrollArea>
      </div>

      {!readonly && searchPanelOpened && (
        <>
          <div className="separator"></div>
          <div className="panel-search-user">
            <div style={{ height: '55px' }}>
              <TextFieldset
                name={'username'}
                value={searchValue}
                placeholder="Search users..."
                onChange={onSearchChange}
              >
                <div
                  style={{
                    position: 'absolute',
                    top: '50%',
                    left: '10px',
                    transform: 'translateY(-50%)',
                  }}
                >
                  {searchLoading ? <UpdateIcon /> : <MagnifyingGlassIcon />}
                </div>
              </TextFieldset>
            </div>
            <ScrollArea>
              {searchResults.map((u) => (
                <UserListItem
                  key={u.user_id}
                  collaborator={userToCollaborator(u)}
                  onClick={onSearchedUserClicked}
                ></UserListItem>
              ))}
            </ScrollArea>
          </div>
        </>
      )}

      {editedUser && (
        <>
          <div className="separator"></div>
          <div className="panel-edit-scopes">
            <span className="panel-title">Edit scopes</span>
            <div>
              <UserListItem collaborator={editedUser} onClick={undefined}>
                {!readonly && !editedUser.is_owner && (
                  <ButtonIcon
                    Icon={CheckIcon}
                    className="blue"
                    {...validateAction}
                  />
                )}
              </UserListItem>
            </div>
            <ScrollArea>
              {!readonly && !editedUser.is_owner && (
                <p style={{ textAlign: 'center' }}>
                  <ButtonBase text="all" className="small" callback={all} />
                  <ButtonBase text="none" className="small" callback={none} />
                </p>
              )}
              {Object.keys(scopes).map((r) => (
                <Scope
                  key={r}
                  name={r}
                  title={scopes[r].title}
                  value={
                    editedUser.is_owner ? true : editedUser.scope.includes(r)
                  }
                  onChange={
                    !readonly && !editedUser.is_owner
                      ? onScopeChange
                      : undefined
                  }
                />
              ))}
            </ScrollArea>
          </div>
        </>
      )}
    </div>
  );
};

/**
 *
 * @returns
 */

export const UserListItem = ({
  collaborator,
  onClick,
  children,
}: {
  collaborator: TCollaborator;
  onClick?: (u: TF_User) => void;
  children?: ReactNode;
}) => {
  const yet = collaborator.is_owner || collaborator.scope.length > 0;
  return (
    <div
      className={`user-list-item ${yet ? 'collaborator-yet' : ''}`}
      onClick={() => onClick?.(collaborator)}
    >
      <UserInline {...collaborator} color="var(--c-white-1)" />
      {collaborator.is_owner ? (
        <span className="owner-flag">
          <b>owner</b>
        </span>
      ) : (
        children
      )}
    </div>
  );
};

/**
 *
 */

export const ScrollArea = ({ children }: { children: ReactNode }) => (
  <Sa.Root className="ScrollAreaRoot">
    <Sa.Viewport className="ScrollAreaViewport">
      <div style={{ padding: 'var(--sa-vp-padding) var(--sa-vp-padding)' }}>
        {children}
      </div>
    </Sa.Viewport>
    <Sa.Scrollbar className="ScrollAreaScrollbar" orientation="vertical">
      <Sa.Thumb className="ScrollAreaThumb" />
    </Sa.Scrollbar>
    <Sa.Scrollbar className="ScrollAreaScrollbar" orientation="horizontal">
      <Sa.Thumb className="ScrollAreaThumb" />
    </Sa.Scrollbar>
    <Sa.Corner className="ScrollAreaCorner" />
  </Sa.Root>
);

/**
 *
 */

export const Scope = ({
  name,
  title,
  value,
  onChange,
}: {
  name: string;
  title: string;
  value: boolean;
  onChange?: (id: string, v: boolean) => void;
}) => {
  return (
    <div style={{ display: 'flex', alignItems: 'left', padding: '5px 0' }}>
      <Checkbox.Root
        className="CheckboxRoot"
        value={name}
        checked={value}
        id={name}
        onCheckedChange={(v: boolean) => onChange?.(name, v)}
      >
        <Checkbox.Indicator className="CheckboxIndicator">
          <CheckIcon />
        </Checkbox.Indicator>
      </Checkbox.Root>
      <label className="scope-label" htmlFor={name}>
        {title}
      </label>
    </div>
  );
};
