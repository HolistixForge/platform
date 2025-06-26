import {
  TValidSharedDataToCopy,
  FrontendDispatcher,
} from '@monorepo/collab-engine';
import { TCoreSharedData } from '@monorepo/core';
import { TSpaceMenuEntries } from '@monorepo/module/frontend';
import { TJupyterSharedData } from './jupyter-shared-model';
import { NewKernelForm } from './form/new-kernel';
import { NewTerminalForm } from './form/new-terminal';
import { TKernelNodeDataPayload } from './jupyter-types';
import { TJupyterEvent } from './jupyter-events';

//

export const spaceMenuEntrie: TSpaceMenuEntries = ({
  viewId,
  from,
  sharedData,
  position,
  renderForm,
  dispatcher,
}) => {
  const tsd = sharedData as TValidSharedDataToCopy<
    TJupyterSharedData & TCoreSharedData
  >;

  const node = from && tsd.nodes.get(from?.node);
  const project_server_id = node?.data?.project_server_id as number;
  const jupyter = tsd.jupyterServers.get(`${project_server_id}`);

  const d = dispatcher as FrontendDispatcher<TJupyterEvent>;

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
          disabled: !(jupyter && node?.type === 'server'),
        },
        {
          type: 'item',
          label: 'New Cell',
          onClick: () => {
            d.dispatch({
              type: 'jupyter:new-cell',
              kernel_id: (node!.data as TKernelNodeDataPayload).kernel_id,
              origin: {
                viewId: viewId,
                position: position(),
              },
            });
          },
          disabled: node?.type !== 'jupyter-kernel',
        },
        {
          type: 'item',
          label: 'New Terminal',
          onClick: () => {
            renderForm(
              <NewTerminalForm
                project_server_id={project_server_id}
                viewId={viewId}
                position={position()}
                closeForm={() => {
                  renderForm(null);
                }}
              />
            );
          },
          disabled: !(jupyter && node?.type === 'server'),
        },
      ],
    },
  ];
};
