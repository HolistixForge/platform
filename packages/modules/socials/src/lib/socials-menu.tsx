import { TSpaceMenuEntries } from '@holistix-forge/whiteboard/frontend';
import { NewYoutubeForm } from './forms/form-new-youtube';
import { NewNodeUserForm } from './forms/form-new-node-user';
import { NewIframeForm } from './forms/form-new-iframe';

export const socialsMenuEntries: TSpaceMenuEntries = ({
  viewId,
  from,
  sharedData,
  position,
  renderForm,
  dispatcher,
}) => {
  return [
    {
      type: 'sub-menu',
      label: 'Socials',
      entries: [
        {
          type: 'item',
          label: 'New Youtube Video',
          disabled: from !== undefined,
          onClick: () => {
            renderForm(
              <NewYoutubeForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
        },
        {
          type: 'item',
          label: 'New User Id Card',
          disabled: from !== undefined,

          onClick: () => {
            renderForm(
              <NewNodeUserForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
        },
        {
          type: 'item',
          label: 'New Reservation',
          disabled: from !== undefined,
          onClick: () => {
            dispatcher.dispatch({
              type: 'socials:new-reservation',
              origin: {
                viewId: viewId,
                position: position(),
              },
            });
          },
        },
        {
          type: 'item',
          label: 'New Iframe',
          disabled: from !== undefined,
          onClick: () => {
            renderForm(
              <NewIframeForm
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
        },
        {
          type: 'item',
          label: 'New Text Editor',
          disabled: from !== undefined,
          onClick: () => {
            dispatcher.dispatch({
              type: 'socials:new-text-editor',
              origin: {
                viewId: viewId,
                position: position(),
              },
            });
          },
        },
      ],
    },
  ];
};
