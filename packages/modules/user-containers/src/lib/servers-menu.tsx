import { TWhiteboardMenuEntries } from '@holistix-forge/whiteboard/frontend';
import { NewContainerForm } from './form/new-server';

//

export const serversMenuEntries: TWhiteboardMenuEntries = ({
  viewId,
  from,
  position,
  renderForm,
  projectId,
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
              <NewContainerForm
                projectId={projectId}
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
