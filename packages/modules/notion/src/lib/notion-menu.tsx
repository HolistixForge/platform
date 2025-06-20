import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import { NewNotionDatabaseForm } from './components/forms/new-database';

export const notionMenuEntries: TSpaceMenuEntries = ({
  from,
  viewId,
  position,
  renderForm,
}) => {
  return [
    {
      type: 'sub-menu',
      label: 'Notion',
      entries: [
        {
          type: 'item',
          label: 'New Database',
          disabled: from !== undefined,
          onClick: () => {
            renderForm(
              <NewNotionDatabaseForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
        },
      ],
    },
  ];
};
