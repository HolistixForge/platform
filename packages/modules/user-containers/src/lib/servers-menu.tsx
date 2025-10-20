import { TSpaceMenuEntries } from '@monorepo/space/frontend';
import { NewServerForm } from './form/new-server';

//

export const serversMenuEntries: TSpaceMenuEntries = ({
  viewId,
  from,
  position,
  renderForm,
}) => {
  return [
    {
      type: 'sub-menu',
      label: 'user-containers',
      entries: [
        {
          type: 'item',
          label: 'New Server',
          onClick: () => {
            renderForm(
              <NewServerForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
          disabled: from !== undefined,
        },
      ],
    },
  ];
};
