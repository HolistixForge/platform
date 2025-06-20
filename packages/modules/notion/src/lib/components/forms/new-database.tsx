import { useEffect } from 'react';

import {
  ButtonBase,
  FormError,
  FormErrors,
  TextFieldset,
  useAction,
  DialogControlled,
} from '@monorepo/ui-base';
import { useDispatcher } from '@monorepo/collab-engine';
import { TPosition } from '@monorepo/core';

import { TNotionEvent } from '../../notion-events';

/**
 *
 */

export type NewNotionDatabaseFormData = { databaseId: string };

/**
 *
 */

export const NewNotionDatabaseForm = ({
  viewId,
  position,
  closeForm,
}: {
  viewId: string;
  position: TPosition;
  closeForm: () => void;
}) => {
  //

  const dispatcher = useDispatcher<TNotionEvent>();

  const action = useAction<NewNotionDatabaseFormData>(
    (d) => {
      return dispatcher.dispatch({
        type: 'notion:init-database',
        databaseId: d.databaseId,
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
        if (!d.databaseId) e.databaseId = 'Please enter the databse Id';
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

  return (
    <DialogControlled
      title="New Notion Database"
      description="Provide the Notion Database Id."
      open={action.isOpened}
      onOpenChange={action.close}
    >
      <FormError errors={action.errors} id="databaseId" />
      <TextFieldset
        label="Databse Id"
        name="databaseId"
        onChange={action.handleInputChange}
        value={action.formData.databaseId}
        placeholder="Databse Id"
      />

      <FormErrors errors={action.errors} />
      <div
        style={{ display: 'flex', marginTop: 25, justifyContent: 'flex-end' }}
      >
        <ButtonBase
          className="submit"
          callback={() => action.callback(action.formData)}
          text="Load Notion Database"
          loading={action.loading}
        />
      </div>
    </DialogControlled>
  );
};
