import { TValidSharedDataToCopy } from '@monorepo/collab-engine';
import { TCoreSharedData } from '@monorepo/core';
import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import { TJupyterSharedData } from './jupyter-shared-model';
import { NewKernelForm } from './form/new-kernel';

//

export const spaceMenuEntrie: TSpaceMenuEntries = ({
  viewId,
  from,
  sd,
  position,
  renderForm,
}) => {
  const tsd = sd as TValidSharedDataToCopy<
    TJupyterSharedData & TCoreSharedData
  >;

  const node = from && tsd.nodes.get(from?.node);
  const project_server_id = node?.data?.project_server_id as number;
  const jupyter = tsd.jupyterServers.get(`${project_server_id}`);

  return [
    {
      type: 'sub-menu',
      label: 'jupyter',
      entries: [
        {
          type: 'item',
          label: 'New Kernel',
          onClick: () => {
            renderForm(
              <NewKernelForm
                project_server_id={project_server_id}
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
          disabled: !jupyter,
        },
        {
          type: 'item',
          label: 'New Cell',
          onClick: () => {},
          disabled: node?.type !== 'jupyter-cell',
        },
      ],
    },
  ];
};
