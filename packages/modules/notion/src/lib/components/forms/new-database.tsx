import {
  ButtonBase,
  TAction,
  FormError,
  FormErrors,
  TextFieldset,
} from '@monorepo/ui-base';

/**
 *
 */

export type NewNotionDatabaseFormData = { databaseId: string };

/**
 *
 */

export const NewNotionDatabaseForm = ({
  action,
}: {
  action: TAction<NewNotionDatabaseFormData>;
}) => {
  //

  return (
    <>
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
    </>
  );
};
